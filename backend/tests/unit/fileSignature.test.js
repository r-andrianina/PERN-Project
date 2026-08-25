const { matchesSignature, isValidImageBuffer, isValidRawBuffer } = require('../../src/utils/fileSignature');

describe('utils/fileSignature — images', () => {
  it('accepte une signature JPEG', () => {
    expect(isValidImageBuffer(Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]))).toBe(true);
  });
  it('accepte une signature PNG', () => {
    expect(isValidImageBuffer(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))).toBe(true);
  });
  it('accepte une signature TIFF (little et big endian)', () => {
    expect(isValidImageBuffer(Buffer.from([0x49, 0x49, 0x2A, 0x00]))).toBe(true);
    expect(isValidImageBuffer(Buffer.from([0x4D, 0x4D, 0x00, 0x2A]))).toBe(true);
  });
  it('rejette un contenu texte/HTML renommé en image', () => {
    expect(isValidImageBuffer(Buffer.from('<html><script>alert(1)</script></html>'))).toBe(false);
  });
  it('rejette un buffer vide ou tronqué', () => {
    expect(isValidImageBuffer(Buffer.alloc(0))).toBe(false);
    expect(isValidImageBuffer(Buffer.from([0xFF]))).toBe(false);
  });
});

describe('utils/fileSignature — fichiers bruts labo', () => {
  it('accepte une signature gzip pour .gz', () => {
    expect(isValidRawBuffer(Buffer.from([0x1F, 0x8B, 0x08, 0x00]), '.gz')).toBe(true);
  });
  it('rejette un .gz sans signature gzip', () => {
    expect(isValidRawBuffer(Buffer.from('PK\x03\x04'), '.gz')).toBe(false);
  });
  it('accepte une signature ABIF pour .ab1', () => {
    expect(isValidRawBuffer(Buffer.from('ABIF...'), '.ab1')).toBe(true);
  });
  it('rejette un .ab1 sans en-tête ABIF', () => {
    expect(isValidRawBuffer(Buffer.from('random'), '.ab1')).toBe(false);
  });
  it('accepte du texte plein pour .fasta/.fastq/.seq', () => {
    expect(isValidRawBuffer(Buffer.from('>seq1\nACGTACGT\n'), '.fasta')).toBe(true);
    expect(isValidRawBuffer(Buffer.from('@read1\nACGT\n+\nFFFF\n'), '.fastq')).toBe(true);
  });
  it('rejette un contenu binaire (octet nul) renommé en .fasta', () => {
    expect(isValidRawBuffer(Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00]), '.fasta')).toBe(false);
  });
});

describe('utils/fileSignature — matchesSignature (dispatch par extension)', () => {
  it('route les extensions image vers le validateur image', () => {
    expect(matchesSignature(Buffer.from([0xFF, 0xD8, 0xFF]), '.jpg')).toBe(true);
    expect(matchesSignature(Buffer.from('not an image'), '.png')).toBe(false);
  });
  it('route les autres extensions vers le validateur "brut"', () => {
    expect(matchesSignature(Buffer.from([0x1F, 0x8B]), '.gz')).toBe(true);
    expect(matchesSignature(Buffer.from('>seq\nACGT'), '.fa')).toBe(true);
  });
});
