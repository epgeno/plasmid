import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
  detectInitialLanguage,
  formatVaultErrorMessage,
  isSupportedLanguage,
  localizeAuditMessage,
  localizeAuditTypeBadge,
  localizeClinicalSignificance,
  localizeRangeLabel,
  normalizeBrowserLanguage,
  persistLanguageChoice,
} from '../.wrangler/test-build/i18n.js';

const EXPECTED_CODES = ['en', 'es', 'fr', 'de', 'pt', 'ko', 'ja', 'zh'];

const ALLOWED_IDENTICAL_PROPER_NOUN_PATHS = new Set([
  'header.title',
  'landing.zeroBytesValue',
  'intersection.clinvarLinkLabel',
  'navigator.audit.badgeWorker',
  'swarm.kpiRttSub',
  'governance.gnomadAttr',
  'governance.cpicAttr',
]);

function collectLeaves(obj, prefix = '') {
  const entries = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      entries.push(...collectLeaves(v, path));
    } else {
      entries.push([path, v]);
    }
  }
  return entries;
}

function sampleFunctionOutput(fn) {
  // Supply realistic sample args (numbers or strings depending on signature)
  return fn('arg1', 'arg2', 'arg3', 'arg4', 200);
}

test('SUPPORTED_LANGUAGES covers all 8 23andMe demographic languages with native labels', () => {
  assert.deepEqual(
    SUPPORTED_LANGUAGES.map((l) => l.code),
    EXPECTED_CODES
  );
  for (const code of EXPECTED_CODES) {
    assert.equal(isSupportedLanguage(code), true);
    assert.ok(TRANSLATIONS[code], `Missing TRANSLATIONS entry for ${code}`);
  }
  assert.equal(isSupportedLanguage('it'), false);
  assert.equal(isSupportedLanguage(''), false);
});

test('All 8 languages have 100% schema parity, zero empty/placeholder strings, and authentic translations', () => {
  const enLeaves = collectLeaves(TRANSLATIONS.en);
  const enMap = new Map(enLeaves);
  assert.ok(enLeaves.length >= 200, `Expected >=200 translation leaves, got ${enLeaves.length}`);

  for (const code of EXPECTED_CODES) {
    const langLeaves = collectLeaves(TRANSLATIONS[code]);
    assert.deepEqual(
      langLeaves.map(([p]) => p),
      enLeaves.map(([p]) => p),
      `Key mismatch in language "${code}"`
    );

    const identicalPaths = [];

    for (const [path, val] of langLeaves) {
      const enVal = enMap.get(path);
      assert.equal(
        typeof val,
        typeof enVal,
        `Type mismatch at ${code}.${path}: expected ${typeof enVal}, got ${typeof val}`
      );

      if (typeof val === 'string') {
        assert.ok(val.trim().length > 0, `Empty translation string at ${code}.${path}`);
        assert.ok(
          !/\b(TODO|TBD|FIXME|undefined|NaN)\b/.test(val),
          `Placeholder or broken token in ${code}.${path}: ${val}`
        );
        if (code !== 'en' && val === enVal && !ALLOWED_IDENTICAL_PROPER_NOUN_PATHS.has(path)) {
          identicalPaths.push(path);
        }
      } else if (typeof val === 'function') {
        const rendered = sampleFunctionOutput(val);
        assert.equal(typeof rendered, 'string', `Function at ${code}.${path} did not return string`);
        assert.ok(rendered.trim().length > 0, `Empty function output at ${code}.${path}`);
        assert.ok(
          !/undefined|NaN/.test(rendered),
          `Function output at ${code}.${path} leaked undefined/NaN: ${rendered}`
        );
        if (code !== 'en') {
          const enRendered = sampleFunctionOutput(enVal);
          if (rendered === enRendered && !ALLOWED_IDENTICAL_PROPER_NOUN_PATHS.has(path)) {
            identicalPaths.push(path);
          }
        }
      }
    }

    if (code !== 'en') {
      assert.deepEqual(
        identicalPaths,
        [],
        `Language "${code}" has untranslated English copy-paste keys: ${identicalPaths.join(', ')}`
      );
    }
  }
});

test('detectInitialLanguage maps navigator.language across 8 locales and respects localStorage manual override', () => {
  const cases = [
    ['en-US', 'en'],
    ['en-GB', 'en'],
    ['en-AU', 'en'],
    ['en-CA', 'en'],
    ['es-MX', 'es'],
    ['es-419', 'es'],
    ['es-ES', 'es'],
    ['fr-CA', 'fr'],
    ['fr-FR', 'fr'],
    ['de-DE', 'de'],
    ['de-AT', 'de'],
    ['de-CH', 'de'],
    ['pt-BR', 'pt'],
    ['pt-PT', 'pt'],
    ['ko-KR', 'ko'],
    ['ja-JP', 'ja'],
    ['zh-CN', 'zh'],
    ['zh-TW', 'zh'],
    ['zh-HK', 'zh'],
    ['it-IT', 'en'],
    ['nl-NL', 'en'],
    ['', 'en'],
    [null, 'en'],
  ];

  for (const [tag, expected] of cases) {
    assert.equal(normalizeBrowserLanguage(tag), expected, `Failed normalizeBrowserLanguage(${tag})`);
    assert.equal(
      detectInitialLanguage({
        storage: { getItem: () => null },
        navigatorLanguage: tag,
        navigatorLanguages: null,
      }),
      expected,
      `Failed detectInitialLanguage for navigator.language=${tag}`
    );
  }

  // Manual localStorage selection overrides navigator.language
  const store = new Map();
  const mockStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
  };

  persistLanguageChoice('pt', mockStorage);
  assert.equal(store.get(LANGUAGE_STORAGE_KEY), 'pt');
  assert.equal(
    detectInitialLanguage({
      storage: mockStorage,
      navigatorLanguage: 'en-US',
      navigatorLanguages: ['en-US', 'es-MX'],
    }),
    'pt'
  );

  // Invalid stored code falls back cleanly to navigator.language
  store.set(LANGUAGE_STORAGE_KEY, 'invalid-locale');
  assert.equal(
    detectInitialLanguage({
      storage: mockStorage,
      navigatorLanguage: 'fr-CA',
      navigatorLanguages: ['fr-CA'],
    }),
    'fr'
  );
});

test('Vault error, ClinVar significance, and Navigator audit helpers localize across all 8 languages without CJK fallthrough', () => {
  const cjkRegex = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;

  for (const lang of ['es', 'fr', 'de', 'pt']) {
    const errMsg = formatVaultErrorMessage(
      'Unsupported file extension for "sample.bam". Supported formats: .vcf',
      lang
    );
    assert.ok(errMsg.includes('sample.bam'));
    assert.equal(
      cjkRegex.test(errMsg),
      false,
      `European language "${lang}" leaked CJK characters in vault error: ${errMsg}`
    );
    assert.notEqual(errMsg, 'Unsupported file extension for "sample.bam". Supported formats: .vcf');

    const auditMsg = localizeAuditMessage(
      'WASM decoded 14 variant(s), 2 note(s), SHA-256 verified 1 chunk(s)',
      lang
    );
    assert.equal(
      cjkRegex.test(auditMsg),
      false,
      `European language "${lang}" leaked CJK characters in audit log: ${auditMsg}`
    );
    assert.notEqual(
      auditMsg,
      'WASM decoded 14 variant(s), 2 note(s), SHA-256 verified 1 chunk(s)'
    );

    const rangeLbl = localizeRangeLabel('Header 128B', lang);
    assert.equal(cjkRegex.test(rangeLbl), false);

    const netBadge = localizeAuditTypeBadge('network', lang);
    assert.equal(cjkRegex.test(netBadge), false);
    assert.notEqual(netBadge, 'NETWORK');

    const sigDrug = localizeClinicalSignificance('drug_response', lang);
    assert.notEqual(sigDrug, 'Drug response');
    assert.notEqual(sigDrug, 'drug response');
  }

  for (const lang of ['ko', 'ja', 'zh']) {
    const sigPath = localizeClinicalSignificance('Pathogenic', lang);
    assert.equal(cjkRegex.test(sigPath), true);
    const sigPipe = localizeClinicalSignificance('Likely benign|other', lang);
    assert.equal(cjkRegex.test(sigPipe), true);
    assert.equal(/Likely benign/i.test(sigPipe), false);
    assert.equal(sigPipe, TRANSLATIONS[lang].clinicalSig.likelyBenign);
  }

  // Exact token parsing: Conflicting_classifications_of_pathogenicity must NEVER misclassify as Pathogenic
  for (const code of EXPECTED_CODES) {
    const sig = TRANSLATIONS[code].clinicalSig;
    assert.equal(
      localizeClinicalSignificance('Likely_benign|other', code),
      sig.likelyBenign
    );
    assert.equal(
      localizeClinicalSignificance('Likely_pathogenic|risk_factor', code),
      `${sig.likelyPathogenic} · ${sig.riskFactor}`
    );
    assert.equal(
      localizeClinicalSignificance('Conflicting_classifications_of_pathogenicity|risk_factor', code),
      `${sig.conflicting} · ${sig.riskFactor}`
    );
    assert.equal(
      localizeClinicalSignificance('Conflicting_classifications_of_pathogenicity|drug_response|other', code),
      `${sig.conflicting} · ${sig.drugResponse}`
    );
    assert.equal(
      localizeClinicalSignificance('Pathogenic/Likely_pathogenic|drug_response', code),
      `${sig.pathogenicLikelyPathogenic} · ${sig.drugResponse}`
    );
    assert.equal(
      localizeClinicalSignificance('Benign/Likely_benign', code),
      sig.benignLikelyBenign
    );
  }
});

test('P7 LandingView & Home tab translations cover all 8 languages with dynamic ClinVar counts and zero CJK/Latin cross-leakage', () => {
  const cjkRegex = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;

  for (const code of EXPECTED_CODES) {
    const dict = TRANSLATIONS[code];
    assert.equal(typeof dict.header.tabs.home, 'string', `Missing header.tabs.home for ${code}`);
    assert.ok(dict.header.tabs.home.trim().length > 0);
    assert.ok(dict.landing, `Missing landing section for ${code}`);

    // Dynamic ClinVar count CTA must interpolate live runtime count without hardcoded 17,889
    const customDemoLabel = dict.landing.exploreDemoBtn('24,500');
    assert.ok(
      customDemoLabel.includes('24,500'),
      `landing.exploreDemoBtn in ${code} did not interpolate live count: ${customDemoLabel}`
    );
    assert.ok(
      !customDemoLabel.includes('17,889') && !customDemoLabel.includes('17889'),
      `landing.exploreDemoBtn in ${code} hardcoded 17,889: ${customDemoLabel}`
    );

    const activeBanner = dict.landing.activeVaultBanner('genome_23andme_v5.txt');
    assert.ok(activeBanner.includes('genome_23andme_v5.txt'));

    const buildSub = dict.landing.trustClinvarSub('GRCh38');
    assert.ok(buildSub.includes('GRCh38'));

    const integrityVal = dict.landing.livePackIntegrityValue(90);
    assert.ok(integrityVal.includes('90'));

    if (['en', 'es', 'fr', 'de', 'pt'].includes(code)) {
      for (const [leafPath, val] of collectLeaves(dict.landing)) {
        const text = typeof val === 'function' ? sampleFunctionOutput(val) : val;
        assert.equal(
          cjkRegex.test(text),
          false,
          `Latin language "${code}" leaked CJK in landing.${leafPath}: ${text}`
        );
      }
    } else {
      assert.equal(
        cjkRegex.test(dict.landing.heroTitle),
        true,
        `CJK language "${code}" missing native script in landing.heroTitle`
      );
      assert.equal(
        cjkRegex.test(dict.header.tabs.home),
        true,
        `CJK language "${code}" missing native script in header.tabs.home`
      );
    }
  }
});
