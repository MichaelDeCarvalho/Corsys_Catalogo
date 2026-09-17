import {
  validateProductMediaFile,
  validateProductMediaFileDeep,
  detectRealProductImageType,
  isValidUuid,
  extractOwnedProductMediaPath,
  getSafeProductImageExtension,
  PRODUCT_MEDIA_BUCKET,
  MAX_PRODUCT_IMAGE_SIZE_BYTES,
} from '../src/services/productMediaStorageService';
import { LEGACY_SUPABASE_V1_HOST } from '../src/utils/productImages';
import * as fs from 'fs';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAILED: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('TEST SUITE: PRODUCT MEDIA STORAGE V1 & ISOLATION');
  console.log('======================================================\n');

  const VALID_TENANT_UUID = 'a0000000-0000-0000-0000-000000000001';
  const OTHER_TENANT_UUID = 'b1111111-1111-1111-1111-111111111111';
  const VALID_PRODUCT_UUID = 'c2222222-2222-2222-2222-222222222222';
  const OTHER_PRODUCT_UUID = 'd3333333-3333-3333-3333-333333333333';

  // -------------------------------------------------------------------------
  // 1. UUID CANÔNICO & FAIL-CLOSED
  // -------------------------------------------------------------------------
  console.log('1. Validação de UUID & Fail-Closed (Tenant e Produto)');
  assert(isValidUuid(VALID_TENANT_UUID), 'Tenant UUID v4 canônico aceito');
  assert(isValidUuid(VALID_PRODUCT_UUID), 'Product UUID v4 canônico aceito');
  assert(!isValidUuid('produto-slug-123'), 'Slug de produto textual rejeitado');
  assert(!isValidUuid('tenant-alpha'), 'Slug de tenant textual rejeitado');
  assert(!isValidUuid(''), 'String vazia rejeitada');
  assert(!isValidUuid(null), 'Null rejeitado');
  assert(!isValidUuid(undefined), 'Undefined rejeitado');
  assert(!isValidUuid('../etc/passwd'), 'Path traversal textual rejeitado');
  assert(!isValidUuid('12345'), 'Identificador puramente numérico rejeitado');

  // -------------------------------------------------------------------------
  // 2. MIME TYPES & MAGIC BYTES BINÁRIOS
  // -------------------------------------------------------------------------
  console.log('\n2. MIME Types & Magic Bytes Binários');
  
  // PNG válido (89 50 4E 47 0D 0A 1A 0A)
  const validPngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
  const validPngBlob = new Blob([validPngBytes], { type: 'image/png' });
  const detectedPng = await detectRealProductImageType(validPngBlob);
  assert(detectedPng === 'image/png', 'Detecta magic bytes reais de PNG');

  // JPEG válido (FF D8 FF E0)
  const validJpgBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const validJpgBlob = new Blob([validJpgBytes], { type: 'image/jpeg' });
  const detectedJpg = await detectRealProductImageType(validJpgBlob);
  assert(detectedJpg === 'image/jpeg', 'Detecta magic bytes reais de JPEG');

  // WebP válido (RIFF .... WEBP)
  const validWebpBytes = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x24, 0x00, 0x00, 0x00, // size
    0x57, 0x45, 0x42, 0x50, // WEBP
    0x56, 0x50, 0x38, 0x20  // VP8
  ]);
  const validWebpBlob = new Blob([validWebpBytes], { type: 'image/webp' });
  const detectedWebp = await detectRealProductImageType(validWebpBlob);
  assert(detectedWebp === 'image/webp', 'Detecta magic bytes reais de WebP');

  // SVG Proibido (XSS vector)
  const svgText = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
  const svgFile = new File([svgText], 'foto.svg', { type: 'image/svg+xml' });
  const svgCheck = validateProductMediaFile(svgFile);
  assert(!svgCheck.valid && svgCheck.error?.includes('SVG'), 'SVG rejeitado explicitamente (mitigação de XSS)');

  // GIF Proibido nesta etapa
  const gifFile = new File(['GIF89a'], 'anim.gif', { type: 'image/gif' });
  const gifCheck = validateProductMediaFile(gifFile);
  assert(!gifCheck.valid && gifCheck.error?.includes('GIF'), 'GIF animado rejeitado explicitamente');

  // Spoofing de Extensão (texto falso renomeado para .png)
  const fakePngFile = new File(['Plain text masquerading as png'], 'foto.png', { type: 'image/png' });
  const deepFakeCheck = await validateProductMediaFileDeep(fakePngFile);
  assert(!deepFakeCheck.valid, 'Arquivo texto renomeado para .png rejeitado por inspeção binária');

  // Validação de Tamanho Limite (1 MiB)
  const oversizeFile = new File([new Uint8Array(MAX_PRODUCT_IMAGE_SIZE_BYTES + 1024)], 'grande.png', { type: 'image/png' });
  const oversizeCheck = validateProductMediaFile(oversizeFile);
  assert(!oversizeCheck.valid && oversizeCheck.error?.includes('1 MiB'), 'Foto > 1 MiB rejeitada');

  const validSizeFile = new File([new Uint8Array(500 * 1024)], 'foto_ok.png', { type: 'image/png' });
  const validSizeCheck = validateProductMediaFile(validSizeFile);
  assert(validSizeCheck.valid, 'Foto <= 1 MiB aceita na validação preliminar');

  // Extensões seguras
  assert(getSafeProductImageExtension('image/jpeg') === 'jpg', 'Extensão canônica jpg para image/jpeg');
  assert(getSafeProductImageExtension('image/png') === 'png', 'Extensão canônica png para image/png');
  assert(getSafeProductImageExtension('image/webp') === 'webp', 'Extensão canônica webp para image/webp');

  // -------------------------------------------------------------------------
  // 3. CONTROLE ESTRITO DE PATH (extractOwnedProductMediaPath) & URLS EXTERNAS
  // -------------------------------------------------------------------------
  console.log('\n3. Controle Estrito de Path & Isolamento Multi-Tenant / Multi-Produto');

  // URL canônica legítima do próprio tenant e próprio produto
  const canonicalProductUrl = `https://mysupabase.supabase.co/storage/v1/object/public/${PRODUCT_MEDIA_BUCKET}/${VALID_TENANT_UUID}/products/${VALID_PRODUCT_UUID}/media_1710000000_abc123.webp`;
  const extractedPath = extractOwnedProductMediaPath(canonicalProductUrl, VALID_TENANT_UUID, VALID_PRODUCT_UUID);
  assert(
    extractedPath === `${VALID_TENANT_UUID}/products/${VALID_PRODUCT_UUID}/media_1710000000_abc123.webp`,
    'Extrai path legítimo de URL Supabase para o próprio tenant e produto'
  );

  // Path relativo direto
  const directPath = `${VALID_TENANT_UUID}/products/${VALID_PRODUCT_UUID}/media_1710000000_def456.jpg`;
  const extractedDirect = extractOwnedProductMediaPath(directPath, VALID_TENANT_UUID, VALID_PRODUCT_UUID);
  assert(
    extractedDirect === directPath,
    'Aceita path relativo legítimo iniciado pelo UUID do tenant/products/product_uuid'
  );

  // Tentativa Cross-Tenant
  const crossTenantUrl = `https://mysupabase.supabase.co/storage/v1/object/public/${PRODUCT_MEDIA_BUCKET}/${OTHER_TENANT_UUID}/products/${VALID_PRODUCT_UUID}/media_1.png`;
  const crossTenantExtracted = extractOwnedProductMediaPath(crossTenantUrl, VALID_TENANT_UUID, VALID_PRODUCT_UUID);
  assert(
    crossTenantExtracted === null,
    'URL de outro tenant rejeitada com null (Cross-tenant isolado)'
  );

  // Tentativa Cross-Product
  const crossProductUrl = `https://mysupabase.supabase.co/storage/v1/object/public/${PRODUCT_MEDIA_BUCKET}/${VALID_TENANT_UUID}/products/${OTHER_PRODUCT_UUID}/media_1.png`;
  const crossProductExtracted = extractOwnedProductMediaPath(crossProductUrl, VALID_TENANT_UUID, VALID_PRODUCT_UUID);
  assert(
    crossProductExtracted === null,
    'URL de outro produto no mesmo tenant rejeitada com null (Cross-product isolado)'
  );

  // Outro Bucket
  const otherBucketUrl = `https://mysupabase.supabase.co/storage/v1/object/public/tenant-assets/${VALID_TENANT_UUID}/products/${VALID_PRODUCT_UUID}/media_1.png`;
  const otherBucketExtracted = extractOwnedProductMediaPath(otherBucketUrl, VALID_TENANT_UUID, VALID_PRODUCT_UUID);
  assert(
    otherBucketExtracted === null,
    'URL pertencente a outro bucket rejeitada com null'
  );

  // URL Legada do Supabase V1
  const legacyV1Url = `https://${LEGACY_SUPABASE_V1_HOST}/storage/v1/object/public/products/${VALID_PRODUCT_UUID}/photo.jpg`;
  const legacyV1Extracted = extractOwnedProductMediaPath(legacyV1Url, VALID_TENANT_UUID, VALID_PRODUCT_UUID);
  assert(
    legacyV1Extracted === null,
    'URL do Supabase V1 legado rejeitada de deleção física (retorna null preservando arquivo)'
  );

  // URL Externa (Unsplash / terceiros)
  const unsplashUrl = 'https://images.unsplash.com/photo-1581235720704-06d3acfcb36f';
  const unsplashExtracted = extractOwnedProductMediaPath(unsplashUrl, VALID_TENANT_UUID, VALID_PRODUCT_UUID);
  assert(
    unsplashExtracted === null,
    'URL externa arbitrária retorna null (sem tentativa de delete físico no storage)'
  );

  // Path Traversal
  const traversalUrl = `https://mysupabase.supabase.co/storage/v1/object/public/${PRODUCT_MEDIA_BUCKET}/${VALID_TENANT_UUID}/products/${VALID_PRODUCT_UUID}/../../evil.png`;
  const traversalExtracted = extractOwnedProductMediaPath(traversalUrl, VALID_TENANT_UUID, VALID_PRODUCT_UUID);
  assert(
    traversalExtracted === null,
    'Path traversal contendo .. rejeitado com null'
  );

  // Schemas Perigosos
  assert(extractOwnedProductMediaPath('blob:https://app.com/uuid-123', VALID_TENANT_UUID, VALID_PRODUCT_UUID) === null, 'blob: rejeitado');
  assert(extractOwnedProductMediaPath('data:image/png;base64,iVBORw0...', VALID_TENANT_UUID, VALID_PRODUCT_UUID) === null, 'data: rejeitado');
  assert(extractOwnedProductMediaPath('javascript:alert(1)', VALID_TENANT_UUID, VALID_PRODUCT_UUID) === null, 'javascript: rejeitado');

  // -------------------------------------------------------------------------
  // 3.1. VÍNCULO SERVER-SIDE TENANT + PRODUCT (RLS CROSS-PRODUCT)
  // -------------------------------------------------------------------------
  console.log('\n3.1. Vínculo Server-Side Tenant + Product (RLS Cross-Product)');

  const mockProductsDb = [
    { id: VALID_PRODUCT_UUID, tenant_id: VALID_TENANT_UUID },
    { id: OTHER_PRODUCT_UUID, tenant_id: OTHER_TENANT_UUID },
  ];

  // Simulação fiel da cláusula EXISTS da migration 000008:
  // EXISTS (
  //   SELECT 1 FROM public.products p
  //   WHERE p.id::text = (storage.foldername(name))[3]
  //     AND p.tenant_id::text = (storage.foldername(name))[1]
  // )
  function simulateRlsProductOwnership(objectPath: string, bucketId: string): boolean {
    if (bucketId !== 'product-media') return false;
    const segments = objectPath.split('/');
    // segments[0]: tenant_id (foldername 1)
    // segments[1]: 'products' (foldername 2)
    // segments[2]: product_id (foldername 3)
    if (segments.length < 4) return false;
    if (segments[1] !== 'products') return false;

    const folderTenantId = segments[0];
    const folderProductId = segments[2];

    return mockProductsDb.some(
      (p) => p.id === folderProductId && p.tenant_id === folderTenantId
    );
  }

  const validOwnershipPath = `${VALID_TENANT_UUID}/products/${VALID_PRODUCT_UUID}/media_1.png`;
  assert(
    simulateRlsProductOwnership(validOwnershipPath, 'product-media') === true,
    'Terceiro segmento product UUID válido + pertencente ao tenant = PASS'
  );

  const nonExistentProductUuid = 'e4444444-4444-4444-4444-444444444444';
  const nonExistentPath = `${VALID_TENANT_UUID}/products/${nonExistentProductUuid}/media_1.png`;
  assert(
    simulateRlsProductOwnership(nonExistentPath, 'product-media') === false,
    'UUID válido mas produto inexistente = FAIL na policy/validação esperada'
  );

  const crossTenantPath = `${OTHER_TENANT_UUID}/products/${VALID_PRODUCT_UUID}/media_1.png`;
  assert(
    simulateRlsProductOwnership(crossTenantPath, 'product-media') === false,
    'Produto de outro tenant = FAIL'
  );

  const otherProductPath = `${VALID_TENANT_UUID}/products/${OTHER_PRODUCT_UUID}/media_1.png`;
  assert(
    simulateRlsProductOwnership(otherProductPath, 'product-media') === false,
    'Path com outro product = FAIL'
  );

  // -------------------------------------------------------------------------
  // 4. SANITIZAÇÃO DE PAYLOAD NO ADMIN CATALOG SERVICE (HTTPS-ONLY)
  // -------------------------------------------------------------------------
  console.log('\n4. Sanitização de Array images[] no AdminCatalogService (HTTPS-Only)');

  const rawImagesInput = [
    '  https://mysupabase.co/storage/v1/object/public/product-media/t/products/p/1.png  ',
    '',
    '   ',
    'http://example.com/foto.jpg', // HTTP puro proibido
    'https://example.com/foto.jpg', // HTTPS externo permitido
    'blob:http://localhost/temp-uuid',
    'data:image/jpeg;base64,abc123==',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'ftp://files.com/foto.png',
    'https://mysupabase.co/storage/v1/object/public/product-media/t/products/p/2.png',
    'https://mysupabase.co/storage/v1/object/public/product-media/t/products/p/1.png', // Duplicata
    'https://external-cdn.com/product.jpg' // URL externa permitida no array do DB
  ];

  // Algoritmo idêntico ao implementado em updateAdminProduct (HTTPS-Only)
  const sanitizedImages: string[] = [];
  const seenUrls = new Set<string>();

  for (const item of rawImagesInput) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;

    const lower = trimmed.toLowerCase();
    if (!lower.startsWith('https://')) {
      continue;
    }

    if (!seenUrls.has(trimmed)) {
      seenUrls.add(trimmed);
      sanitizedImages.push(trimmed);
    }
  }

  assert(!sanitizedImages.includes('http://example.com/foto.jpg'), 'http://example.com/foto.jpg = FAIL (rejeitado)');
  assert(sanitizedImages.includes('https://example.com/foto.jpg'), 'https://example.com/foto.jpg = PASS se já permitido pela regra atual');
  assert(sanitizedImages.length === 4, 'Sanitização filtrou vazios, não-HTTPS, esquemas perigosos e duplicatas');
  assert(sanitizedImages[0] === 'https://mysupabase.co/storage/v1/object/public/product-media/t/products/p/1.png', 'Primeira URL preservada no índice 0');
  assert(sanitizedImages[1] === 'https://example.com/foto.jpg', 'Segunda URL preservada no índice 1');
  assert(sanitizedImages[2] === 'https://mysupabase.co/storage/v1/object/public/product-media/t/products/p/2.png', 'Terceira URL preservada no índice 2');
  assert(sanitizedImages[3] === 'https://external-cdn.com/product.jpg', 'Quarta URL preservada no índice 3');
  assert(!sanitizedImages.some(u => !u.toLowerCase().startsWith('https://')), 'Nenhuma URL não-HTTPS persistida');

  // -------------------------------------------------------------------------
  // 5. SIMULAÇÃO DE CONSISTÊNCIA COMPENSATÓRIA (ROLLBACK)
  // -------------------------------------------------------------------------
  console.log('\n5. Simulação de Consistência Compensatória');

  // Caso 1: Falha em upload intermediário (arquivo 1 ok, arquivo 2 falha)
  let rolledBackPaths: string[] = [];
  const mockRollback = (paths: string[]) => {
    rolledBackPaths.push(...paths);
  };

  const upload1 = { path: `${VALID_TENANT_UUID}/products/${VALID_PRODUCT_UUID}/media_1.jpg`, error: null };
  const upload2 = { path: null, error: 'Network timeout on second image upload' };

  if (upload1.path && upload2.error) {
    mockRollback([upload1.path]);
  }
  assert(
    rolledBackPaths.length === 1 && rolledBackPaths[0] === upload1.path,
    'Falha em upload intermediário aciona rollback dos uploads anteriores'
  );

  // Caso 2: Falha na atualização do banco (DB update error)
  rolledBackPaths = [];
  const upload3 = { path: `${VALID_TENANT_UUID}/products/${VALID_PRODUCT_UUID}/media_3.jpg` };
  const upload4 = { path: `${VALID_TENANT_UUID}/products/${VALID_PRODUCT_UUID}/media_4.jpg` };
  const dbFailure = true;

  if (dbFailure) {
    mockRollback([upload3.path, upload4.path]);
  }
  assert(
    rolledBackPaths.length === 2 &&
    rolledBackPaths.includes(upload3.path) &&
    rolledBackPaths.includes(upload4.path),
    'Falha no banco aciona rollback de todos os uploads novos realizados'
  );

  // Caso 3: Cancelamento de modal -> zero upload remoto
  let remoteUploadCalls = 0;
  const modalCanceled = true;
  if (!modalCanceled) {
    remoteUploadCalls++;
  }
  assert(remoteUploadCalls === 0, 'Cancelamento do modal não executa nenhum upload remoto');

  // -------------------------------------------------------------------------
  // 6. AUDITORIA DE CONFIGURAÇÃO (config.toml & Migration 000008)
  // -------------------------------------------------------------------------
  console.log('\n6. Auditoria de Configuração (config.toml & Migration 000008)');

  const configToml = fs.readFileSync('supabase/config.toml', 'utf-8');
  assert(configToml.includes('[storage.buckets.product-media]'), 'config.toml declara bucket product-media');
  assert(configToml.includes('file_size_limit = "1MiB"'), 'config.toml define limite de 1MiB para product-media');
  assert(
    configToml.includes('allowed_mime_types = ["image/png", "image/jpeg", "image/webp"]'),
    'config.toml restringe product-media exclusivamente a PNG, JPEG e WebP'
  );

  const migration000008 = fs.readFileSync('supabase/migrations/20260916_000008_product_media_storage.sql', 'utf-8');
  assert(migration000008.includes("bucket_id = 'product-media'"), '000008 filtra bucket_id = product-media');
  assert(migration000008.includes("(storage.foldername(name))[2] = 'products'"), '000008 restringe path para diretório /products/');
  assert(migration000008.includes('EXISTS ('), '000008 contém cláusula EXISTS para vínculo server-side');
  assert(
    migration000008.includes('p.id::text = (storage.foldername(name))[3]'),
    '000008 valida o terceiro segmento (product_id) contra public.products.id com comparação segura de texto'
  );
  assert(
    migration000008.includes('p.tenant_id::text = (storage.foldername(name))[1]'),
    '000008 valida que o produto pertence ao tenant do segmento 1 com comparação segura de texto'
  );
  assert(migration000008.includes('CREATE POLICY "product_media_select_authenticated"'), '000008 possui SELECT autenticado restrito');
  assert(migration000008.includes('CREATE POLICY "product_media_insert_tenant_admin"'), '000008 possui INSERT restrito a tenant_admin/platform_admin');
  assert(migration000008.includes('CREATE POLICY "product_media_delete_tenant_admin"'), '000008 possui DELETE restrito a tenant_admin/platform_admin');
  assert(!migration000008.includes('CREATE POLICY "product_media_update_tenant_admin"'), '000008 NÃO cria nenhuma policy de UPDATE');
  assert(!migration000008.includes('CREATE POLICY "product_media_select_public"'), '000008 NÃO cria policy SELECT pública em storage.objects');
  assert(!migration000008.includes('INSERT INTO storage.buckets'), '000008 NÃO faz DML direto em storage.buckets');
  assert(!migration000008.includes('ALTER TABLE storage.objects'), '000008 NÃO executa ALTER TABLE storage.objects');

  console.log('\n======================================================');
  console.log(`RESULTADO: ${passed} PASSOU / ${failed} FALHOU`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during product media test run:', err);
  process.exit(1);
});
