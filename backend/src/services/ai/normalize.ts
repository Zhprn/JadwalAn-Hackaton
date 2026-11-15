import prisma from '../../lib/prisma';
import { cached } from '../../lib/cache';

/**
 * Normalisasi chat pelanggan yang typo / disingkat / bahasa gaul.
 *
 * Dipakai untuk:
 *  - router berbasis aturan (supaya "bsk bkg ps5 jm 7" tetap dikenali sebagai booking),
 *  - memberi petunjuk ke agent ("kemungkinan maksud pelanggan: ...").
 *
 * Kamus bisa "dilatih" admin: tambah Basis Pengetahuan dengan kategori `kamus`,
 *   question = kata typo/singkatan (boleh beberapa, pisahkan koma) → content = arti yang benar.
 *   contoh: question "bkg, bking, boking"  content "booking"
 */

const BUILTIN: Record<string, string> = {
  // booking & sewa
  bkg: 'booking', bking: 'booking', boking: 'booking', bokin: 'booking', bookin: 'booking', buking: 'booking', bukin: 'booking',
  pesen: 'pesan', psn: 'pesan', mesen: 'pesan', sewain: 'sewa', nyewa: 'sewa',
  rental: 'sewa', maen: 'main', mabar: 'main bareng',
  // waktu
  bsk: 'besok', besuk: 'besok', bso: 'besok', lsa: 'lusa', ntr: 'nanti', nnt: 'nanti', ntar: 'nanti', skrg: 'sekarang',
  skrng: 'sekarang', skr: 'sekarang', sekrg: 'sekarang', hr: 'hari', hri: 'hari', mlm: 'malam', malem: 'malam', mlem: 'malam',
  sor: 'sore', pgi: 'pagi', pg: 'pagi', siank: 'siang', jm: 'jam', jem: 'jam', mnt: 'menit', dtk: 'detik', minggu2: 'minggu',
  sabtu2: 'sabtu', weekend: 'akhir pekan', wiken: 'akhir pekan',
  // pertanyaan
  brp: 'berapa', brapa: 'berapa', brpa: 'berapa', berapaan: 'berapa', hrg: 'harga', hrga: 'harga', hargany: 'harganya',
  ad: 'ada', ada2: 'ada', adakah: 'ada', kosng: 'kosong', ksong: 'kosong', ksg: 'kosong', kosog: 'kosong', pnuh: 'penuh', fuul: 'penuh', full: 'penuh',
  gmn: 'gimana', gmna: 'gimana', gimn: 'gimana', bgmn: 'bagaimana', knp: 'kenapa', napa: 'kenapa', kpn: 'kapan', dmn: 'dimana', dimn: 'dimana',
  sapa: 'siapa', apaan: 'apa',
  // jawaban singkat
  y: 'ya', iy: 'iya', iya: 'iya', yoi: 'iya', yups: 'iya', yup: 'iya', yap: 'iya', ok: 'oke', okk: 'oke', oks: 'oke', okey: 'oke',
  okeh: 'oke', okay: 'oke', sip: 'oke', siap: 'oke', gass: 'gas', gaskeun: 'gas', cus: 'gas', kuy: 'ayo', yuk: 'ayo', jd: 'jadi',
  jdi: 'jadi', g: 'tidak', ga: 'tidak', gk: 'tidak', gak: 'tidak', ngga: 'tidak', nggak: 'tidak', engga: 'tidak', enggak: 'tidak',
  tdk: 'tidak', gajadi: 'tidak jadi', gjd: 'tidak jadi', btl: 'batal', btlin: 'batalkan', cancel: 'batal', cansel: 'batal',
  // kata umum
  yg: 'yang', dg: 'dengan', dgn: 'dengan', sm: 'sama', sma: 'sama', utk: 'untuk', untk: 'untuk', tp: 'tapi', tpi: 'tapi',
  krn: 'karena', karna: 'karena', klo: 'kalau', kalo: 'kalau', kl: 'kalau', lg: 'lagi', lgi: 'lagi', aja: 'saja', aj: 'saja', ja: 'saja',
  udh: 'sudah', udah: 'sudah', dah: 'sudah', sdh: 'sudah', blm: 'belum', blom: 'belum', belom: 'belum', bisa2: 'bisa', bs: 'bisa', bsa: 'bisa',
  mau2: 'mau', mw: 'mau', mo: 'mau', pengen: 'ingin', pgn: 'ingin', pngn: 'ingin', org: 'orang', orng: 'orang', bnyk: 'banyak',
  sy: 'saya', aq: 'aku', ak: 'aku', gw: 'saya', gue: 'saya', w: 'saya', km: 'kamu', kmu: 'kamu', lu: 'kamu', lo: 'kamu',
  tlg: 'tolong', tolongin: 'tolong', makasih: 'terima kasih', mksh: 'terima kasih', thx: 'terima kasih', tq: 'terima kasih', thanks: 'terima kasih',
  kk: 'kak', ka: 'kak', bang: 'kak', bro: 'kak', gan: 'kak',
  // pembayaran
  qr: 'qris', qriss: 'qris', kris: 'qris', qiris: 'qris', tf: 'transfer', trf: 'transfer', trnsfr: 'transfer', cas: 'cash', kes: 'cash',
  tunai: 'cash', byr: 'bayar', bayr: 'bayar', bayarin: 'bayar',
  // konsol
  stick: 'stik',
};

/** Angka/konsol yang sering ditulis menempel: "ps5", "jam7", "2jam", "ps 5". */
const PATTERNS: [RegExp, string][] = [
  [/\bp\s*s\s*([45])\b/gi, 'PS$1'],
  [/\bjam(\d{1,2})\b/gi, 'jam $1'],
  [/\b(\d{1,2})\s*j(?:a?m)?\b/gi, '$1 jam'],
  [/\bjm\s*(\d{1,2})\b/gi, 'jam $1'],
];

const typoEntries = () =>
  cached('ai:typo-dict', 60_000, async () => {
    const rows = await prisma.aiKnowledge.findMany({
      where: { isActive: true, category: 'kamus' },
      select: { question: true, content: true },
    });
    const dict: Record<string, string> = {};
    for (const r of rows) {
      const meaning = r.content.trim();
      if (!meaning) continue;
      for (const w of (r.question ?? '').split(/[,;\n]/)) {
        const key = w.trim().toLowerCase();
        if (key) dict[key] = meaning;
      }
    }
    return dict;
  });

/** "haloooo" → "halo", "okeee" → "oke" (huruf berulang ≥3 dipadatkan). */
const squeeze = (w: string) => w.replace(/([a-z])\1{2,}/g, '$1');

export type Normalized = { text: string; changed: boolean };

export const normalizeMessage = async (raw: string): Promise<Normalized> => {
  let custom: Record<string, string> = {};
  try {
    custom = await typoEntries();
  } catch {
    // kamus admin opsional — kalau DB lambat tetap pakai kamus bawaan
  }

  let text = raw.replace(/\s+/g, ' ').trim();
  for (const [re, rep] of PATTERNS) text = text.replace(re, rep);

  // Frasa multi-kata dari kamus admin (mis. "gak jd") diganti dulu.
  for (const [k, v] of Object.entries(custom)) {
    if (k.includes(' ')) text = text.replace(new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), v);
  }

  text = text
    .split(' ')
    .map((tok) => {
      const m = tok.match(/^([^a-z0-9]*)([a-z0-9]+)([^a-z0-9]*)$/i);
      if (!m) return tok;
      const [, pre, word, post] = m;
      const lower = word.toLowerCase();
      const hit = custom[lower] ?? BUILTIN[lower] ?? custom[squeeze(lower)] ?? BUILTIN[squeeze(lower)];
      if (hit) return `${pre}${hit}${post}`;
      const sq = squeeze(lower);
      return sq !== lower ? `${pre}${sq}${post}` : tok;
    })
    .join(' ');

  return { text, changed: text.toLowerCase() !== raw.replace(/\s+/g, ' ').trim().toLowerCase() };
};

/** Pesan pendek (≤ 4 kata) — kemungkinan besar lanjutan dari topik sebelumnya. */
export const isShortMessage = (text: string) => text.trim().split(/\s+/).length <= 4;
