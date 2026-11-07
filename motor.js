// =============================================================
// Yalancı Zar - oyun motoru: kurallar, sıra, zehirli bardaklar, istatistikler, botlar
// Ekrandan bağımsızdır (online oyunda oda sahibinin cihazında çalışır).
//
// Kurallar:
//   - Herkesin bardağında 5 zar var. Her tur başında herkes bardağını sallar, kendi zarlarına bakar.
//   - Sırası gelen masadaki TÜM zarlar hakkında iddiada bulunur: "en az X tane Y var".
//   - Sıradaki ya iddiayı artırır (daha çok adet, ya da aynı adette daha büyük sayı) ya da "Yalancı!" der.
//   - "Yalancı!": bardaklar kalkar. En az X tane Y varsa suçlayan, yoksa iddia eden kaybeder.
//   - Jokerli oyunda 1'ler joker: her iddiaya eklenir (o zaman 1 üzerine iddia edilmez).
//   - TAM'lı oyunda sıradaki "TAM!" diyebilir: tam X tane varsa iddia eden, yoksa TAM diyen kaybeder.
//   - Herkesin önünde 2 zehirli bardak var: kaybeden birini içer. İkincisini de içen ölür, mumu söner.
//   - En son hayatta kalan kazanır.
// =============================================================

const Motor = (() => {
  const ZAR = 5;
  const BARDAK = 2;
  const SURE = 30;
  const BEKLE = { salla: 1900, acilis: 3600, icHazir: 2600, sonra: 2400, tur: 900 };

  let o = null;
  let dinleyici = () => {};
  let zamanlayici = null, sayacZamani = null, botZamani = null;

  const rastgele = n => Math.floor(Math.random() * n);
  const zarAt = () => 1 + rastgele(6);
  const canlilar = () => o.oyuncular.filter(p => p.canli);
  const olay = (tip, veri = {}) => {
    try {
      dinleyici(tip, veri);
    } catch (e) {
      console.error('Olay işlenirken hata:', tip, e);   // ekran hatası oyunu durdurmasın
    }
  };
  const enKucukYuz = () => (o.ayar.joker ? 2 : 1);

  // Masada iddia edilen sayıdan kaç tane var (joker açıksa 1'ler de sayılır)
  function say(yuz) {
    let n = 0;
    o.oyuncular.forEach(p => p.canli && p.zarlar.forEach(z => (z === yuz || (o.ayar.joker && z === 1 && yuz !== 1)) && n++));
    return n;
  }
  const toplamZar = () => canlilar().length * ZAR;

  // ---------- Kurulum ----------
  // oyuncular: [{ ad, karakter, bot, kiyafet }], ayar: { joker, tam }
  function yeni(oyuncular, dinle, ayar = {}) {
    temizle();
    dinleyici = dinle || (() => {});
    o = {
      oyuncular: oyuncular.map((p, no) => ({
        no, ad: p.ad, karakter: p.karakter, kiyafet: p.kiyafet || null, bot: !!p.bot,
        zarlar: [], canli: true, bardak: BARDAK,
        cesaret: 0.35 + Math.random() * 0.45,
        istat: { yalan: 0, yakalandi: 0, yakaladi: 0, bosSuclama: 0, yutturdu: 0, icti: 0, tamBildi: 0, tamYanildi: 0, iddia: 0, olumSirasi: 0 },
      })),
      ayar: { joker: !!ayar.joker, tam: !!ayar.tam },
      sira: 0, iddia: null, turNo: 0, olenSayisi: 0,
      asama: 'tur', kaybeden: null, kazanan: null, acilan: null, bitis: 0,
    };
    setTimeout(() => turBaslat(rastgele(oyuncular.length)), 300);
    return o;
  }

  function temizle() {
    clearTimeout(zamanlayici);
    clearTimeout(botZamani);
    clearInterval(sayacZamani);
    zamanlayici = botZamani = sayacZamani = null;
  }

  // Yeni tur: herkes bardağını sallar
  function turBaslat(baslayan) {
    o.turNo++;
    o.asama = 'salla';
    o.iddia = null;
    o.kaybeden = null;
    o.acilan = null;
    o.oyuncular.forEach(p => (p.zarlar = p.canli ? [...Array(ZAR)].map(zarAt).sort() : []));
    o.sira = siradakiCanli(baslayan, true);
    olay('tur', { turNo: o.turNo, sira: o.sira, sure: BEKLE.salla });
    zamanlayici = setTimeout(() => {
      o.asama = 'oyun';
      siraBaslat();
    }, BEKLE.salla);
  }

  function siradakiCanli(no, dahil) {
    const n = o.oyuncular.length;
    for (let k = dahil ? 0 : 1; k <= n; k++) {
      const p = o.oyuncular[(no + k) % n];
      if (p.canli) return p.no;
    }
    return no;
  }

  // Bu iddia bir öncekinden büyük mü?
  function gecerliMi(adet, yuz) {
    if (!Number.isInteger(adet) || !Number.isInteger(yuz) || yuz < enKucukYuz() || yuz > 6 || adet < 1 || adet > toplamZar()) return false;
    if (!o.iddia) return true;
    return adet > o.iddia.adet || (adet === o.iddia.adet && yuz > o.iddia.yuz);
  }
  // En küçük geçerli artırma
  function enKucukArtis() {
    if (!o.iddia) return { adet: 1, yuz: enKucukYuz() };
    if (o.iddia.yuz < 6) return { adet: o.iddia.adet, yuz: o.iddia.yuz + 1 };
    if (o.iddia.adet < toplamZar()) return { adet: o.iddia.adet + 1, yuz: enKucukYuz() };
    return null;
  }

  function siraBaslat() {
    clearInterval(sayacZamani);
    clearTimeout(botZamani);
    const p = o.oyuncular[o.sira];
    o.bitis = Date.now() + SURE * 1000;
    olay('sira', { no: o.sira, bitis: o.bitis });
    if (p.bot) {
      botZamani = setTimeout(() => botOyna(p), 1600 + Math.random() * 2000);
    } else {
      // Süre biterse: en küçük artırma yapılır, artırılamıyorsa "Yalancı!"
      sayacZamani = setInterval(() => {
        if (o.asama !== 'oyun' || o.sira !== p.no || Date.now() < o.bitis) return;
        clearInterval(sayacZamani);
        const a = o.iddia ? enKucukArtis() : { adet: 1, yuz: enCokYuz(p) };
        if (a) iddiaEt(p.no, a.adet, a.yuz);
        else yalanci(p.no);
      }, 250);
    }
  }

  // ---------- Hamleler ----------
  function iddiaEt(no, adet, yuz) {
    if (!o || o.asama !== 'oyun' || o.sira !== no || !gecerliMi(adet, yuz)) return false;
    const p = o.oyuncular[no];
    // Önceki iddia yalandı ve kimse suçlamadan geçtiyse: yutturdu
    if (o.iddia && say(o.iddia.yuz) < o.iddia.adet) o.oyuncular[o.iddia.no].istat.yutturdu++;
    if (say(yuz) < adet) p.istat.yalan++;
    p.istat.iddia++;
    o.iddia = { no, adet, yuz };
    clearInterval(sayacZamani);
    olay('iddia', { no, adet, yuz, r: Math.random() });
    o.sira = siradakiCanli(no, false);
    zamanlayici = setTimeout(siraBaslat, 600);
    return true;
  }

  // tur: 'yalanci' ya da 'tam'
  function ac(no, tur) {
    if (!o || o.asama !== 'oyun' || o.sira !== no || !o.iddia) return false;
    if (tur === 'tam' && !o.ayar.tam) return false;
    clearInterval(sayacZamani);
    clearTimeout(botZamani);
    o.asama = 'acilis';
    const { adet, yuz } = o.iddia;
    const atan = o.iddia.no;
    const sayi = say(yuz);
    let kaybeden;
    if (tur === 'tam') {
      const bildi = sayi === adet;
      kaybeden = bildi ? atan : no;
      o.oyuncular[no].istat[bildi ? 'tamBildi' : 'tamYanildi']++;
    } else {
      const dogru = sayi >= adet;
      kaybeden = dogru ? no : atan;
      if (dogru) o.oyuncular[no].istat.bosSuclama++;
      else {
        o.oyuncular[atan].istat.yakalandi++;
        o.oyuncular[no].istat.yakaladi++;
      }
    }
    o.kaybeden = kaybeden;
    o.acilan = { tur, no, atan, adet, yuz, sayi, zarlar: o.oyuncular.map(p => p.zarlar) };
    olay('ac', { ...o.acilan, kaybeden, joker: o.ayar.joker, r: Math.random() });
    // Zarlar tek tek sayılırken bekle (her zar 0,6 sn), sonra sonucu okumaya biraz zaman
    zamanlayici = setTimeout(icHazirla, BEKLE.acilis + Math.max(1, sayi) * 600);
    return true;
  }
  const yalanci = no => ac(no, 'yalanci');
  const tam = no => ac(no, 'tam');

  function icHazirla() {
    o.asama = 'ic';
    const p = o.oyuncular[o.kaybeden];
    olay('icHazir', { no: p.no, bardak: p.bardak });
    zamanlayici = setTimeout(ic, BEKLE.icHazir);
  }

  function ic() {
    const p = o.oyuncular[o.kaybeden];
    p.bardak--;
    p.istat.icti++;
    const oldu = p.bardak <= 0;
    if (oldu) {
      p.canli = false;
      p.zarlar = [];
      p.istat.olumSirasi = ++o.olenSayisi;
    }
    olay('ic', { no: p.no, kalan: p.bardak, oldu, r: Math.random() });
    zamanlayici = setTimeout(() => {
      const kalan = canlilar();
      if (kalan.length <= 1) {
        o.asama = 'bitti';
        o.kazanan = kalan[0]?.no ?? -1;
        olay('bitti', { kazanan: o.kazanan, istat: o.oyuncular.map(x => ({ no: x.no, ad: x.ad, karakter: x.karakter, ...x.istat })) });
        return;
      }
      o.asama = 'tur';
      olay('turBitti', {});
      zamanlayici = setTimeout(() => turBaslat(p.canli ? p.no : siradakiCanli(p.no, false)), BEKLE.tur);
    }, oldu ? BEKLE.sonra + 600 : BEKLE.sonra);
  }

  // ---------- Botlar ----------
  // Kendi zarlarını bilir; diğer zarlar için beklenen sayı: her zar 1/6 (jokerde 1/3) ihtimalle tutar
  const ihtimal = yuz => (o.ayar.joker && yuz !== 1 ? 1 / 3 : 1 / 6);
  function bende(p, yuz) {
    return p.zarlar.filter(z => z === yuz || (o.ayar.joker && z === 1 && yuz !== 1)).length;
  }
  function beklenen(p, yuz) {
    return bende(p, yuz) + (toplamZar() - p.zarlar.length) * ihtimal(yuz);
  }
  function enCokYuz(p) {
    let en = enKucukYuz(), enN = -1;
    for (let y = enKucukYuz(); y <= 6; y++) {
      const n = bende(p, y) + Math.random() * 0.5;
      if (n > enN) { enN = n; en = y; }
    }
    return en;
  }

  function botOyna(p) {
    if (o.asama !== 'oyun' || o.sira !== p.no) return;
    if (o.iddia) {
      const { adet, yuz } = o.iddia;
      const bek = beklenen(p, yuz);
      // TAM: beklenen sayı iddiaya çok yakınsa ara sıra dener
      if (o.ayar.tam && Math.abs(bek - adet) < 0.35 && Math.random() < 0.25) return void tam(p.no);
      // İddia beklenenin ne kadar üstünde? Üstündeyse suçlama ihtimali artar
      const fark = adet - bek;
      let suclama = 0.04 + fark * 0.22 + (p.cesaret - 0.55) * 0.3 + (p.bardak === 1 ? -0.08 : 0);
      if (adet > bende(p, yuz) + (toplamZar() - p.zarlar.length)) suclama = 1;   // imkânsız iddia
      if (Math.random() < Math.max(0.03, Math.min(0.95, suclama))) return void yalanci(p.no);
    }
    oyna(p);
  }

  function oyna(p) {
    // En çok bende olan sayıyla, beklenen sayıyı aşmayan (ara sıra blöf) en küçük geçerli iddia
    const adaylar = [];
    for (let y = enKucukYuz(); y <= 6; y++) {
      const bek = beklenen(p, y);
      const blof = Math.random() < p.cesaret * 0.5 ? 1 : 0;
      let adet = Math.max(1, Math.floor(bek + 0.25) + blof);
      if (o.iddia && !(adet > o.iddia.adet || (adet === o.iddia.adet && y > o.iddia.yuz))) {
        adet = y > o.iddia.yuz ? o.iddia.adet : o.iddia.adet + 1;
      }
      if (adet > toplamZar()) continue;
      adaylar.push({ adet, yuz: y, risk: adet - bek - bende(p, y) * 0.2 });
    }
    adaylar.sort((a, b) => a.risk - b.risk);
    const s = adaylar[0] || enKucukArtis();
    if (s && iddiaEt(p.no, s.adet, s.yuz)) return;
    yalanci(p.no);
  }

  // ---------- Dışarıya gösterilen hâl ----------
  function gorunum(no) {
    if (!o) return null;
    return {
      sira: o.sira, asama: o.asama, turNo: o.turNo, iddia: o.iddia, kaybeden: o.kaybeden, kazanan: o.kazanan,
      bitis: o.bitis, acilan: o.acilan, ayar: o.ayar, toplamZar: toplamZar(), enKucukYuz: enKucukYuz(),
      oyuncular: o.oyuncular.map(p => ({
        no: p.no, ad: p.ad, karakter: p.karakter, kiyafet: p.kiyafet, bot: p.bot, yedekBot: !!p.yedekBot,
        canli: p.canli, bardak: p.bardak, zarSayisi: p.zarlar.length, zarlar: p.no === no ? p.zarlar : null,
      })),
    };
  }

  function botYap(no, evet) {
    const p = o?.oyuncular[no];
    if (!p || p.bot === evet) return;
    p.bot = evet;
    p.yedekBot = evet;
    if (o.asama === 'oyun' && o.sira === no) {
      clearInterval(sayacZamani);
      clearTimeout(botZamani);
      if (evet) botZamani = setTimeout(() => botOyna(p), 1200);
      else siraBaslat();
    }
  }

  return {
    yeni, temizle, iddiaEt, yalanci, tam, gorunum, botYap, gecerliMi: (a, y) => o && gecerliMi(a, y), SURE, ZAR, BARDAK,
    get aktif() { return !!o && o.asama !== 'bitti'; },
  };
})();
