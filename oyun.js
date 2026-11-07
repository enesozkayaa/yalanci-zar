// =============================================================
// Yalancı Zar - ekran: menü, karakter seçimi, zarlarım, iddia paneli, düğmeler, mesajlar, tepkiler
// Motor'dan (ya da online'da oda sahibinden) gelen olaylara göre sahneyi oynatır.
// Masa: tek başına / oda sahibiyken Motor, başkasının odasındayken Uzak (hamleleri oda sahibine yollar).
// =============================================================

const $ = id => document.getElementById(id);
const ANAHTAR_AD = 'yalanciZar.ad';
const ANAHTAR_KARAKTER = 'yalanciZar.karakter';
const kayitOku = (a, v) => { try { return localStorage.getItem(a) ?? v; } catch (e) { return v; } };
const kayitYaz = (a, v) => { try { localStorage.setItem(a, v); } catch (e) { /* yok */ } };
const guvenli = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let Masa = Motor;
const ui = {
  benimNo: 0,
  durum: null,
  karakter: kayitOku(ANAHTAR_KARAKTER, 'horoz'),
  etiketler: {},
  bakisSayac: { no: -1, sure: 0 },
  ozelBakis: {},
  secAdet: 1, secYuz: 2,     // iddia panelindeki seçim
};
const online = () => typeof Ag !== 'undefined' && Ag.mod !== 'yerel';

// Zar resmi (ekrandaki küçük zarlar için)
const zarResimOnbellek = {};
function zarResmi(n) {
  if (!zarResimOnbellek[n]) {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    g.fillStyle = '#f4ecd8';
    g.beginPath(); g.roundRect(4, 4, 88, 88, 16); g.fill();
    g.strokeStyle = '#b8a77e'; g.lineWidth = 4; g.stroke();
    const d = { 1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [1, 3], [3, 1], [3, 3]], 5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]], 6: [[1, 1], [1, 2], [1, 3], [3, 1], [3, 2], [3, 3]] }[n];
    g.fillStyle = n === 1 ? '#b3261e' : '#1a1a1a';
    d.forEach(([x, y]) => { g.beginPath(); g.arc(x * 24, y * 24, n === 1 ? 12 : 9, 0, 7); g.fill(); });
    zarResimOnbellek[n] = c.toDataURL();
  }
  return zarResimOnbellek[n];
}
const zarImg = (n, sinif = '') => `<img class="zarResim ${sinif}" src="${zarResmi(n)}" alt="${n}">`;

// ---------- Botların lafları ----------
const SOZLER = {
  iddia: ['Bence {a} tane {y} var! 🤠', '{a} tane {y}, iddiaya varım.', 'Hıh… {a} tane {y}.', 'Gözüme bak: {a} tane {y}!', 'Annemin mezarı üstüne {a} tane {y}!'],
  yalanci: ['YALANCI!', 'Hadi ordan!', 'Yemezler!', 'Kaldırın bardakları!', 'Kokusu buraya geliyor!'],
  tam: ['TAM! Tam o kadar!', 'TAM! Kokluyorum…', 'Ne bir eksik ne bir fazla: TAM!'],
  sevindi: ['Hah! Yakaladım seni!', 'Söylemiştim!', 'İç bakalım, yalancı.'],
  icti: ['Öhö öhö… iğrenç!', 'Midem yanıyor! 🤢', 'Bir daha asla…', 'Bu zehir değil, viski!'],
  oldu: { akbaba: 'Cenaze benden… 🦅', diger: ['Mumu söndü…', 'Toprağı bol olsun.', 'Zehre dayanamadı…'] },
};
const sec = (liste, r) => liste[Math.floor((r ?? Math.random()) * liste.length) % liste.length];

// ---------- Menü ----------
function menuKur() {
  $('adim').value = kayitOku(ANAHTAR_AD, '');
  const kap = $('karakterler');
  Karakterler.TURLER.forEach(t => {
    const b = document.createElement('button');
    b.className = 'karakterBtn';
    b.dataset.tur = t;
    const bilgi = Karakterler.BILGI[t];
    b.innerHTML = `<span class="emoji">${bilgi.emoji}</span>${bilgi.ad}`;
    b.addEventListener('click', () => {
      if (b.classList.contains('alindi')) return;
      ui.karakter = t;
      kayitYaz(ANAHTAR_KARAKTER, t);
      karakterGoster();
      Ses.sec();
      if (online()) Ag.karakterSec(t);
    });
    kap.appendChild(b);
  });
  if (!Karakterler.BILGI[ui.karakter]) ui.karakter = 'horoz';
  karakterGoster();
  $('botlaBtn').addEventListener('click', botlaBasla);
}
function karakterGoster() {
  document.querySelectorAll('.karakterBtn').forEach(b => b.classList.toggle('secili', b.dataset.tur === ui.karakter));
  $('karakterAciklama').textContent = Karakterler.BILGI[ui.karakter].aciklama;
}

function botlaBasla() {
  Ses.hazirla();
  const ad = $('adim').value.trim() || 'Sen';
  kayitYaz(ANAHTAR_AD, $('adim').value.trim());
  const kalan = Karakterler.TURLER.filter(t => t !== ui.karakter).sort(() => Math.random() - 0.5);
  const oyuncular = [{ ad, karakter: ui.karakter, bot: false, kiyafet: Giydir.kiyafet(ui.karakter) }];
  for (let i = 0; i < 3; i++) oyuncular.push({ ad: Karakterler.BILGI[kalan[i]].ad, karakter: kalan[i], bot: true });
  ui.son = oyuncular;
  ui.sonAyar = Giydir.motorAyari();
  Masa = Motor;
  Motor.yeni(oyuncular, olayGeldi, ui.sonAyar);
  oyunEkraniniKur(Motor.gorunum(0), 0);
}

function oyunEkraniniKur(d, benimNo) {
  ui.benimNo = benimNo;
  ui.durum = d;
  Masa = online() && Ag.mod === 'misafir' ? Uzak : Motor;
  $('menu').hidden = true;
  $('oyun').hidden = false;
  $('sonEkran').hidden = true;
  $('olumPerdesi').hidden = true;
  $('acilan').hidden = true;
  $('sahne').classList.toggle('olu', !d.oyuncular[benimNo].canli);
  Sahne.kur(d.oyuncular, benimNo);
  Sahne.kadehleriAyarla(d.oyuncular);
  Sahne.olumleriUygula(d.oyuncular);
  etiketleriKur();
  zarlarimCiz();
  iddiaSeciminiSifirla();
  ciz();
  Ses.muzikBaslat();
}

function menuyeDon() {
  if (online()) {
    Ag.ayril();
    return;
  }
  Motor.temizle();
  Ses.gerilimDurdur(true);
  $('oyun').hidden = true;
  $('menu').hidden = false;
  $('sahne').classList.remove('olu');
}

// ---------- Olaylar ----------
const adi = no => ui.durum.oyuncular[no].ad;
const yuzAdi = y => ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı'][y];

function olayGeldi(tip, v, d) {
  ui.durum = d || Motor.gorunum(ui.benimNo);
  d = ui.durum;
  const p = no => d.oyuncular[no];
  if (tip === 'tur') {
    $('acilan').hidden = true;
    Sahne.bardaklariSalla(d.oyuncular, d.oyuncular[ui.benimNo].zarlar);
    Ses.zarSalla();
    mesaj(`🎲 ${v.turNo}. TUR`, 'iri orta', 1600);
    ui.zarGizli = true;
    zarlarimCiz();
    setTimeout(() => {
      ui.zarGizli = false;
      zarlarimCiz(true);
    }, (v.sure || 1800) - 200);
    iddiaSeciminiSifirla();
  } else if (tip === 'sira') {
    if (v.no === ui.benimNo) {
      Ses.siraSende();
      iddiaSeciminiSifirla();
    }
    bakislar();
  } else if (tip === 'iddia') {
    const laf = p(v.no).bot && v.r < 0.5 ? sec(SOZLER.iddia, v.r * 2).replace('{a}', v.adet).replace('{y}', v.yuz) : `${v.adet} tane ${v.yuz}!`;
    balon(v.no, laf);
    Sahne.konus(v.no, 1.2);
    Ses.kartAc(1);
    $('sonIddia').classList.remove('yeni');
    void $('sonIddia').offsetWidth;
    $('sonIddia').classList.add('yeni');
    const bakan = d.oyuncular.filter(x => x.bot && x.canli && x.no !== v.no);
    if (bakan.length && v.r > 0.45) Sahne.ifade(bakan[Math.floor(v.r * 10) % bakan.length].no, 'supheli', 2.5);
  } else if (tip === 'ac') {
    const tamMi = v.tur === 'tam';
    balon(v.no, p(v.no).bot ? sec(tamMi ? SOZLER.tam : SOZLER.yalanci, v.r) : tamMi ? 'TAM!' : 'YALANCI!', true);
    Sahne.tepki(v.no, 'bagir', 1.2);
    Sahne.tepki(v.atan, 'zipla', 1);
    Ses.yalanci();
    d.oyuncular.forEach(x => x.bot && x.no !== v.no && Sahne.bak(x.no, 'masa'));
    setTimeout(() => {
      Ses.bardakKalk();
      $('acilan').hidden = false;
      $('acilan').innerHTML = `<p>${zarImg(v.yuz)} sayılıyor… <b id="sayac">0</b> / ${v.adet}</p>`;
      Sahne.zarlariAc(v.zarlar, v.yuz, v.joker, (n) => {
        const s = $('sayac');
        if (s) s.textContent = n;
        if (n) Ses.zarSay(n);
      });
    }, 500);
    // Sonuç: sayım bittikten sonra
    const sonucZamani = 500 + 1000 + Math.max(1, v.sayi) * 600 + 500;
    setTimeout(() => {
      const kim = v.kaybeden === ui.benimNo ? 'Sen' : adi(v.kaybeden);
      const sonuc = tamMi
        ? (v.sayi === v.adet ? `🎯 TAM bildi! Masada tam ${v.sayi} tane var.` : `❌ TAM değil: masada ${v.sayi} tane var.`)
        : (v.sayi >= v.adet ? `✅ Doğruymuş! Masada ${v.sayi} tane var.` : `🤥 Yalan! Masada sadece ${v.sayi} tane var.`);
      $('acilan').innerHTML = `<p>${sonuc}</p><p class="kaybeden">🧪 ${kim === 'Sen' ? 'Zehri sen içeceksin' : `${guvenli(kim)} zehri içecek`}</p>`;
      const iyi = tamMi ? v.sayi === v.adet : v.sayi < v.adet;
      iyi ? Ses.dogruCikti() : Ses.yalanCikti();
      const kazanan = v.kaybeden === v.no ? v.atan : v.no;
      Sahne.tepki(kazanan, 'gul', 1.6);
      if (p(kazanan).bot) balon(kazanan, sec(SOZLER.sevindi, v.r));
      Sahne.ifade(v.kaybeden, 'korkmus', 4);
    }, sonucZamani);
  } else if (tip === 'icHazir') {
    Sahne.icmeBasla(v.no);
    Ses.gerilimBaslat(2.6);
    mesaj(v.no === ui.benimNo ? `🧪 Zehirli bardağı içiyorsun… (${v.bardak === 1 ? 'SON bardak!' : '1. bardak'})` : `🧪 ${adi(v.no)} zehri içiyor… (${v.bardak === 1 ? 'SON bardak!' : '1. bardak'})`, 'kirmizi', 2600);
    setTimeout(() => Ses.icme(), 1100);
    Sahne.terle(v.no, 2.4);
    d.oyuncular.forEach(x => x.bot && x.no !== v.no && Sahne.bak(x.no, v.no));
  } else if (tip === 'ic') {
    $('acilan').hidden = true;
    Ses.gerilimDurdur();
    Sahne.icmeBitti(v.no, v.oldu);
    Sahne.bardaklariKapat();
    if (v.oldu) {
      Ses.bam();
      setTimeout(Ses.mum, 500);
      mesaj(v.no === ui.benimNo ? '☠️ Zehir işledi… Mumun söndü 🕯️' : `☠️ ${adi(v.no)} zehre dayanamadı, mumu söndü 🕯️`, 'iri kirmizi', 2600);
      if (v.no === ui.benimNo) {
        $('sahne').classList.add('olu');
        $('olumMenuBtn').textContent = online() ? '👀 İzlemeye devam' : '🏠 Ana menü';
        setTimeout(() => ($('olumPerdesi').hidden = false), 1600);
      }
      const yasayan = d.oyuncular.filter(x => x.canli && x.bot);
      const konusan = yasayan.find(x => x.karakter === 'akbaba') || yasayan[Math.floor(v.r * yasayan.length)];
      if (konusan) setTimeout(() => balon(konusan.no, konusan.karakter === 'akbaba' ? SOZLER.oldu.akbaba : sec(SOZLER.oldu.diger, v.r)), 1400);
    } else {
      Ses.oksuruk();
      mesaj(v.no === ui.benimNo ? '🤢 Öhö öhö! Bir bardak daha içersen ölürsün!' : `🤢 ${adi(v.no)} öksürüyor… bir bardağı kaldı!`, '', 2400);
      if (p(v.no).bot) setTimeout(() => balon(v.no, sec(SOZLER.icti, v.r)), 600);
      if (v.no === ui.benimNo) yesilEkran();
    }
  } else if (tip === 'bitti') {
    setTimeout(() => sonuGoster(v.kazanan, v.istat), 1200);
  }
  ciz();
}

// Zehri içince ekran yeşillenip bulanıklaşır
function yesilEkran() {
  const s = $('sahne');
  s.classList.remove('zehir');
  void s.offsetWidth;
  s.classList.add('zehir');
}

// ---------- Domates (mumu sönenler atar) ----------
let sonDomates = 0;
function domatesFirlat(hedef) {
  if (Date.now() - sonDomates < 2000) return;
  sonDomates = Date.now();
  Ag.domatesGonder(hedef);
  const yeni = Istatistik.domatesAtildi();
  yeni.forEach(r => setTimeout(() => mesaj(`🏅 Yeni rozet: ${r.emoji} ${r.ad}`, 'iri', 3000), 900));
}
function domatesGoster(kimden, hedef) {
  if (!ui.durum) return;
  const bana = hedef === ui.benimNo;
  Sahne.domatesAt(kimden, hedef, bana);
  Ses.domates();
  if (bana) {
    setTimeout(ekranaDomates, 700);
    setTimeout(() => mesaj(`🍅 ${adi(kimden)} sana domates attı!`, '', 2000), 750);
  }
}
// Ekrana yapışan domates: ezik domates (çekirdekli, parçalı, parlak) görüşü kapatır, suyu 2 sn boyunca
// aşağı doğru akar, sonra yavaşça kaybolur.
function ekranaDomates() {
  const c = $('domatesKanvas');
  const w = (c.width = innerWidth), h = (c.height = innerHeight);
  const g = c.getContext('2d');
  const R = Math.min(w, h) * (0.3 + Math.random() * 0.06);
  const cx = w * (0.35 + Math.random() * 0.3), cy = h * (0.28 + Math.random() * 0.2);
  // Eziğin kendisi: bir kez çizilip saklanır
  const ez = document.createElement('canvas');
  ez.width = w;
  ez.height = h;
  const e = ez.getContext('2d');
  const sekil = [...Array(5)].map(() => [Math.random() * 6, 2 + Math.floor(Math.random() * 5), 0.05 + Math.random() * 0.12]);
  const kenar = a => R * (1 + sekil.reduce((t, [f, n, s]) => t + Math.sin(a * n + f) * s, 0));
  const yol = (olcek, dx = 0, dy = 0) => {
    e.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2, r = kenar(a) * olcek;
      e.lineTo(cx + dx + Math.cos(a) * r, cy + dy + Math.sin(a) * r * 0.9);
    }
    e.closePath();
  };
  // Etrafa sıçrayan damlalar
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, u = R * (1.05 + Math.random() * 0.8), r = 4 + Math.random() * R * 0.07;
    e.fillStyle = `rgba(${170 + Math.random() * 40},${14 + Math.random() * 20},10,0.92)`;
    e.beginPath();
    e.ellipse(cx + Math.cos(a) * u, cy + Math.sin(a) * u, r, r * (0.6 + Math.random() * 0.4), a, 0, 7);
    e.fill();
  }
  // Ana ezik: koyu kenar, içte açık kırmızı, sulu parlaklık
  const gr = e.createRadialGradient(cx - R * 0.2, cy - R * 0.25, R * 0.1, cx, cy, R * 1.1);
  gr.addColorStop(0, '#ff5a3c');
  gr.addColorStop(0.55, '#d8241a');
  gr.addColorStop(1, '#8e0f0a');
  e.fillStyle = gr;
  yol(1);
  e.fill();
  // İç et parçaları (daha açık, düzensiz)
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2, u = R * Math.random() * 0.6;
    e.fillStyle = `rgba(255,${90 + Math.random() * 50},${70 + Math.random() * 30},0.55)`;
    e.beginPath();
    e.ellipse(cx + Math.cos(a) * u, cy + Math.sin(a) * u, R * (0.12 + Math.random() * 0.12), R * (0.07 + Math.random() * 0.08), Math.random() * 3, 0, 7);
    e.fill();
  }
  // Çekirdekler (sarımsı, jöleli)
  for (let i = 0; i < 34; i++) {
    const a = Math.random() * Math.PI * 2, u = R * Math.sqrt(Math.random()) * 0.75;
    const x = cx + Math.cos(a) * u, y = cy + Math.sin(a) * u, b = 3 + Math.random() * 4;
    e.fillStyle = 'rgba(255,190,120,0.35)';
    e.beginPath(); e.ellipse(x, y, b * 1.9, b * 1.4, a, 0, 7); e.fill();
    e.fillStyle = '#f2d27a';
    e.beginPath(); e.ellipse(x, y, b, b * 0.6, a, 0, 7); e.fill();
  }
  // Kabuk parçası ve sap
  e.fillStyle = '#b5150e';
  e.beginPath(); e.ellipse(cx + R * 0.45, cy - R * 0.35, R * 0.22, R * 0.1, -0.6, 0, 7); e.fill();
  e.fillStyle = '#3a7a2a';
  for (let i = 0; i < 5; i++) {
    e.beginPath();
    e.ellipse(cx - R * 0.3 + Math.cos(i * 1.26) * 10, cy - R * 0.45 + Math.sin(i * 1.26) * 10, 12, 4, i * 1.26, 0, 7);
    e.fill();
  }
  // Islak parlaklık
  e.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 6; i++) {
    e.beginPath();
    e.ellipse(cx - R * 0.35 + Math.random() * R * 0.5, cy - R * 0.4 + Math.random() * R * 0.4, 6 + Math.random() * 16, 3 + Math.random() * 5, -0.5, 0, 7);
    e.fill();
  }
  // Akan su: eziğin alt kenarından aşağı süzülen damlalar
  const akintilar = [...Array(9 + Math.floor(Math.random() * 5))].map(() => {
    const a = Math.PI * (0.15 + Math.random() * 0.7);   // alt yarım
    return {
      x: cx + Math.cos(a) * kenar(a) * 0.85, y0: cy + Math.sin(a) * kenar(a) * 0.8,
      gen: 7 + Math.random() * 16, boy: 0, hiz: 70 + Math.random() * 130, sal: Math.random() * 6,
    };
  });
  const bas = performance.now();
  c.style.transition = 'none';
  c.style.opacity = '1';
  cancelAnimationFrame(ekranaDomates.istek);
  const ciz = () => {
    const t = (performance.now() - bas) / 1000;
    g.clearRect(0, 0, w, h);
    akintilar.forEach(a => {
      if (t < 2.2) {
        a.boy += a.hiz * (1 - t / 3) * (1 / 60) * (0.6 + Math.random() * 0.8);   // giderek yavaşlar
      }
      const x = a.x + Math.sin(t * 2 + a.sal) * 3;
      const ust = a.y0 - 10, alt = a.y0 + a.boy;
      const gr2 = g.createLinearGradient(0, ust, 0, alt);
      gr2.addColorStop(0, 'rgba(200,24,14,0.95)');
      gr2.addColorStop(1, 'rgba(170,16,10,0.85)');
      g.fillStyle = gr2;
      g.beginPath();
      g.moveTo(x - a.gen / 2, ust);
      g.quadraticCurveTo(x - a.gen * 0.42, (ust + alt) / 2, x - a.gen * 0.3, alt);
      g.arc(x, alt, a.gen * 0.42, Math.PI, 0, true);   // ucunda damla
      g.quadraticCurveTo(x + a.gen * 0.42, (ust + alt) / 2, x + a.gen / 2, ust);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x - a.gen * 0.2, ust, 2, a.boy * 0.8);
    });
    g.drawImage(ez, 0, 0);
    if (t < 2.6) ekranaDomates.istek = requestAnimationFrame(ciz);
    else {
      // Akış bitti: yavaşça silinir
      c.style.transition = 'opacity 1.4s';
      c.style.opacity = '0';
    }
  };
  ciz();
}

// Mumu sönmüş botlar ara sıra yaşayanlara domates atar (tek başına ya da oda sahibiyken)
setInterval(() => {
  const d = ui.durum;
  if (!d || d.asama === 'bitti' || $('oyun').hidden || Masa !== Motor) return;
  const yasayan = d.oyuncular.filter(p => p.canli);
  d.oyuncular.filter(p => !p.canli && p.bot).forEach(p => {
    if (Math.random() < 0.1 && yasayan.length) Ag.domatesDagit(p.no, yasayan[Math.floor(Math.random() * yasayan.length)].no);
  });
}, 4000);

// Botların bakışları: sıradakine bakarlar, sıradaki bot kartlarına bakar.
// Ben bir bota bir süre bakarsam o da bana bakar. (İnsan oyuncuların kafası kendi ekranlarından gelir.)
function bakislar() {
  const d = ui.durum;
  if (!d || d.asama !== 'oyun') return;
  const simdi = performance.now();
  d.oyuncular.forEach(p => {
    if (!p.bot || !p.canli) return;
    if (ui.ozelBakis[p.no] > simdi) Sahne.bak(p.no, ui.benimNo);
    else if (p.no === d.sira) Sahne.bak(p.no, Math.random() < 0.6 ? 'kart' : d.sonNo >= 0 ? d.sonNo : 'masa');
    else Sahne.bak(p.no, d.sira);
  });
}
setInterval(() => {
  if ($('oyun').hidden || !ui.durum) return;
  const no = Sahne.baktigim();
  const p = ui.durum.oyuncular[no];
  if (no === ui.bakisSayac.no && no >= 0 && p?.bot) {
    ui.bakisSayac.sure += 0.3;
    if (ui.bakisSayac.sure > 1 && !(ui.ozelBakis[no] > performance.now())) {
      ui.ozelBakis[no] = performance.now() + 2000;
      Sahne.bak(no, ui.benimNo);
      Sahne.ifade(no, Math.random() < 0.5 ? 'supheli' : 'kizgin', 2);
      if (Math.random() < 0.35) Sahne.tepki(no, Math.random() < 0.5 ? 'dusun' : 'gul', 1.2);
    }
  } else ui.bakisSayac = { no, sure: 0 };
  bakislar();
}, 300);
// Kendi bakışımı (kafamın yönünü) odadakilere yolla
setInterval(() => {
  if (online() && !$('oyun').hidden) Ag.bakisGonder(Sahne.bakis.yaw, Sahne.bakis.pitch);
}, 150);


// ---------- Çizim ----------
function ciz() {
  const d = ui.durum;
  if (!d) return;
  // Son iddia (üstte)
  const iddia = d.iddia;
  const kurallar = [d.ayar?.joker ? '🃏 1\'ler joker' : '', d.ayar?.tam ? '🎯 TAM var' : ''].filter(Boolean).join(' · ') || 'Klasik';
  $('sonIddia').innerHTML = iddia
    ? `<div><small>${guvenli(iddia.no === ui.benimNo ? 'Senin iddian' : adi(iddia.no) + ' diyor ki')}</small><b>${iddia.adet} tane</b></div>${zarImg(iddia.yuz)}<div><small>Masada ${d.toplamZar} zar</small><small>${kurallar}</small></div>`
    : `<div><small>Henüz iddia yok</small><b>🎲 Tur ${d.turNo}</b></div><div><small>Masada ${d.toplamZar} zar</small><small>${kurallar}</small></div>`;
  d.oyuncular.forEach(p => {
    const e = ui.etiketler[p.no];
    if (!e) return;
    e.el.classList.toggle('sirada', d.asama === 'oyun' && d.sira === p.no);
    e.el.classList.toggle('olu', !p.canli);
    const ses = online() && Ag.sesteMi(p.no) ? ' 🎙️' : '';
    const bot = p.yedekBot ? ' · 🤖 bot oynuyor' : '';
    e.bilgi.textContent = p.canli ? `🎲 ${p.zarSayisi} · ${'🧪'.repeat(p.bardak)}${'⚫'.repeat(Motor.BARDAK - p.bardak)}${bot}${ses}` : '🕯️ mumu söndü';
  });
  const ben = d.oyuncular[ui.benimNo];
  const sirada = d.asama === 'oyun' && d.sira === ui.benimNo && ben.canli;
  $('benimBilgi').classList.toggle('sirada', sirada);
  $('benimBilgi').innerHTML = ben.canli
    ? `${Karakterler.BILGI[ben.karakter].emoji} <b>${guvenli(ben.ad)}</b> · ${'🧪'.repeat(ben.bardak)}${'⚫'.repeat(Motor.BARDAK - ben.bardak)} <small>(${ben.bardak === 1 ? 'son bardağın!' : '2 bardağın var'})</small>${sirada ? ' · <b>Sıra sende!</b>' : ''}`
    : '🕯️ Mumun söndü';
  iddiaPaneliCiz(sirada);
  $('alt').style.visibility = ben.canli ? '' : 'hidden';
  // Mumu söndüyse: domates at
  const domatesVar = !ben.canli && d.asama !== 'bitti';
  $('domatesCubugu').hidden = !domatesVar;
  if (domatesVar) {
    $('domatesCubugu').innerHTML = '<span>🍅 Domates at:</span>' + d.oyuncular.filter(p => p.canli)
      .map(p => `<button data-no="${p.no}">${Karakterler.BILGI[p.karakter].emoji} ${guvenli(p.ad)}</button>`).join('');
  }
}

// Alttaki kendi zarlarım (sallanırken gizli)
function zarlarimCiz(yeni) {
  const ben = ui.durum?.oyuncular[ui.benimNo];
  const kap = $('zarlarim');
  if (!ben?.zarlar?.length || !ben.canli) {
    kap.innerHTML = '';
    return;
  }
  const d = ui.durum;
  const iddiaYuz = d.iddia?.yuz;
  kap.innerHTML = ui.zarGizli
    ? '<div class="sallaniyor">🎲 Bardak sallanıyor…</div>'
    : ben.zarlar.map((z, i) => {
      const tutar = iddiaYuz && (z === iddiaYuz || (d.ayar?.joker && z === 1 && iddiaYuz !== 1));
      return `<span class="zarKutu${yeni ? ' yeni' : ''}${tutar ? ' tutar' : ''}" style="animation-delay:${i * 0.07}s">${zarImg(z)}</span>`;
    }).join('');
}

// ---------- İddia paneli ----------
function iddiaSeciminiSifirla() {
  const d = ui.durum;
  if (!d) return;
  const enKucuk = d.enKucukYuz || 1;
  if (d.iddia) {
    // Bir öncekinden en küçük artış
    if (d.iddia.yuz < 6) { ui.secAdet = d.iddia.adet; ui.secYuz = d.iddia.yuz + 1; }
    else { ui.secAdet = d.iddia.adet + 1; ui.secYuz = enKucuk; }
  } else {
    // İlk iddia: elimde en çok olan sayı, o kadar adet
    const zar = d.oyuncular[ui.benimNo].zarlar || [];
    let en = enKucuk, enN = 0;
    for (let y = enKucuk; y <= 6; y++) {
      const n = zar.filter(z => z === y || (d.ayar?.joker && z === 1)).length;
      if (n > enN) { enN = n; en = y; }
    }
    ui.secYuz = en;
    ui.secAdet = Math.max(1, enN);
  }
}
const iddiaGecerli = (adet, yuz) => {
  const d = ui.durum;
  if (!d || yuz < (d.enKucukYuz || 1) || yuz > 6 || adet < 1 || adet > d.toplamZar) return false;
  return !d.iddia || adet > d.iddia.adet || (adet === d.iddia.adet && yuz > d.iddia.yuz);
};
function iddiaPaneliCiz(sirada) {
  const d = ui.durum;
  const enKucuk = d.enKucukYuz || 1;
  $('adetSayi').textContent = ui.secAdet;
  $('yuzSecim').innerHTML = [1, 2, 3, 4, 5, 6].map(y =>
    `<button data-yuz="${y}" class="${y === ui.secYuz ? 'secili' : ''}" ${y < enKucuk ? 'disabled title="Jokerli oyunda 1 üzerine iddia edilmez"' : ''}>${zarImg(y)}</button>`).join('');
  const gecerli = iddiaGecerli(ui.secAdet, ui.secYuz);
  $('iddiaBtn').disabled = !sirada || !gecerli;
  $('iddiaBtn').innerHTML = `📢 ${ui.secAdet} tane ${zarImg(ui.secYuz, 'mini')} de`;
  $('yalanciBtn').disabled = !sirada || !d.iddia;
  $('tamBtn').hidden = !d.ayar?.tam;
  $('tamBtn').disabled = !sirada || !d.iddia;
  $('iddiaPaneli').hidden = !sirada;   // sadece sıra bende iken (masayı kapatmasın)
  $('iddiaUyari').textContent = sirada && !gecerli ? (d.iddia ? 'Bir öncekinden büyük olmalı: daha çok adet ya da aynı adette daha büyük sayı.' : '') : '';
  zarlarimCiz();
}
$('adetEksi').addEventListener('click', () => { ui.secAdet = Math.max(1, ui.secAdet - 1); Ses.sec(); ciz(); });
$('adetArti').addEventListener('click', () => { ui.secAdet = Math.min(ui.durum?.toplamZar || 20, ui.secAdet + 1); Ses.sec(); ciz(); });
$('yuzSecim').addEventListener('click', e => {
  const b = e.target.closest('button[data-yuz]');
  if (!b || b.disabled) return;
  ui.secYuz = +b.dataset.yuz;
  Ses.sec();
  ciz();
});
$('iddiaBtn').addEventListener('click', () => {
  if (iddiaGecerli(ui.secAdet, ui.secYuz)) Masa.iddiaEt(ui.benimNo, ui.secAdet, ui.secYuz);
});
$('yalanciBtn').addEventListener('click', () => Masa.yalanci(ui.benimNo));
$('tamBtn').addEventListener('click', () => Masa.tam(ui.benimNo));

function etiketleriKur() {
  const kap = $('etiketler');
  kap.innerHTML = '';
  ui.etiketler = {};
  ui.durum.oyuncular.forEach(p => {
    if (p.no === ui.benimNo) return;
    const el = document.createElement('div');
    el.className = 'etiket';
    el.innerHTML = `<div class="balon"></div><div class="kutu"><div class="ad">${Karakterler.BILGI[p.karakter].emoji} ${guvenli(p.ad)}</div><div class="bilgi"></div></div>`;
    kap.appendChild(el);
    ui.etiketler[p.no] = { el, bilgi: el.querySelector('.bilgi'), balon: el.querySelector('.balon') };
  });
  Sahne.etiketGuncelle = () => {
    for (const no in ui.etiketler) {
      const e = ui.etiketler[no];
      const k = Sahne.ekranKonumu(+no);
      e.el.style.display = k ? '' : 'none';
      if (k) e.el.style.transform = `translate(${k.x}px, ${Math.max(k.y, 118)}px) translate(-50%, -100%)`;
    }
  };
}

function balon(no, yazi, kirmizi, sohbet) {
  if (no === ui.benimNo) {
    mesaj(`Sen: “${yazi}”`, kirmizi ? 'kirmizi' : '', sohbet ? 2500 : 1400);
    return;
  }
  const e = ui.etiketler[no];
  if (!e) return;
  e.balon.textContent = yazi;
  e.balon.className = 'balon goster' + (kirmizi ? ' kirmizi' : '');
  if (ui.durum?.oyuncular[no]?.bot) Sahne.konus(no, Math.min(2, 0.4 + yazi.length * 0.05));
  clearTimeout(e.zaman);
  e.zaman = setTimeout(() => (e.balon.className = 'balon'), sohbet ? 3500 : 2200);
}

const TEPKI_HAREKET = { '😂': 'gul', '😡': 'bagir', '😱': 'zipla', '🤠': 'salla', '👍': 'salla', '🤥': 'dusun' };
function tepkiGoster(no, e) {
  if (!ui.durum || !Object.keys(TEPKI_HAREKET).includes(e)) return;
  if (no === ui.benimNo) {
    mesaj(`Sen: ${e}`, 'iri', 1200);
    return;
  }
  balon(no, e);
  Sahne.tepki(no, TEPKI_HAREKET[e], 1.4);
}

let mesajZamani = null;
function mesaj(yazi, sinif = '', sure = 2000) {
  const m = $('mesaj');
  m.textContent = yazi;
  m.className = 'goster ' + sinif;
  clearTimeout(mesajZamani);
  mesajZamani = setTimeout(() => (m.className = sinif), sure);
}

function sonuGoster(kazanan, istat) {
  const d = ui.durum;
  $('olumPerdesi').hidden = true;
  $('sonEkran').hidden = false;
  $('domatesCubugu').hidden = true;
  if (istat) {
    const oduller = Istatistik.oduller(istat, d.ayar);
    $('oduller').innerHTML = oduller.map(o => `<div class="odul"><span>${o.emoji}</span><div><b>${o.ad}: ${guvenli(o.kim)}</b><small>${o.aciklama}</small></div></div>`).join('');
    const yeni = Istatistik.oyunBitti(istat.find(p => p.no === ui.benimNo), kazanan === ui.benimNo);
    $('yeniRozet').innerHTML = yeni.map(r => `<div class="rozet var"><span>${r.emoji}</span><b>Yeni rozet: ${r.ad}</b><small>${r.aciklama}</small></div>`).join('');
  }
  const misafir = online() && Ag.mod === 'misafir';
  $('tekrarBtn').hidden = misafir;
  $('sonBekle').hidden = !misafir;
  if (kazanan === ui.benimNo) {
    Ses.kazandin();
    $('sonBaslik').textContent = '🏆 Kazandın!';
    $('sonYazi').textContent = 'Masada ayakta kalan bir tek sen oldun. Zehir sana işlemedi!';
  } else {
    const p = d.oyuncular[kazanan];
    $('sonBaslik').textContent = `🏆 ${p ? `${Karakterler.BILGI[p.karakter].emoji} ${p.ad}` : 'Kimse'} kazandı`;
    $('sonYazi').textContent = 'Saloonda ayakta kalan son kişi o oldu.';
  }
}

// Süre çubuğu
setInterval(() => {
  const d = ui.durum;
  const c = $('sureCubugu').firstElementChild;
  if (!d || d.asama !== 'oyun' || d.sira !== ui.benimNo) { c.style.width = '0'; return; }
  const kalan = Math.max(0, (d.bitis - Date.now()) / (Motor.SURE * 1000));
  c.style.width = `${kalan * 100}%`;
  if (kalan < 0.25 && Math.round(Date.now() / 250) % 4 === 0) Ses.tikTak();
}, 250);

// ---------- Düğmeler ----------
$('menuBtn').addEventListener('click', () => {
  const soru = online() ? (Ag.mod === 'ev' ? 'Odayı kapatıp ana menüye dönülsün mü? (Arkadaşlarının oyunu da biter)' : 'Odadan çıkılsın mı? (Yerine bot oynar, aynı adla geri girebilirsin)') : 'Oyundan çıkıp ana menüye dönülsün mü?';
  if ((!Motor.aktif && !online()) || confirm(soru)) menuyeDon();
});
$('olumMenuBtn').addEventListener('click', () => (online() ? ($('olumPerdesi').hidden = true) : menuyeDon()));
$('sonMenuBtn').addEventListener('click', menuyeDon);
$('tekrarBtn').addEventListener('click', () => {
  if (online()) Ag.oyunuBaslat();
  else {
    Motor.yeni(ui.son, olayGeldi, ui.sonAyar);
    oyunEkraniniKur(Motor.gorunum(0), 0);
  }
});
document.querySelectorAll('#tepkiler button').forEach(b => b.addEventListener('click', () => {
  Ses.sec();
  Ag.tepkiGonder(b.textContent);
}));
$('domatesCubugu').addEventListener('click', e => {
  const b = e.target.closest('button[data-no]');
  if (b) domatesFirlat(+b.dataset.no);
});
function sesDugmesi() {
  $('sesBtn').textContent = Ses.acik ? '🔊' : '🔇';
  $('muzikBtn').classList.toggle('kapali', !Ses.muzikAcik);
}
$('sesBtn').addEventListener('click', () => { Ses.ac(!Ses.acik); sesDugmesi(); });
$('muzikBtn').addEventListener('click', () => { Ses.muzikAc(!Ses.muzikAcik); sesDugmesi(); });
sesDugmesi();

Sahne.baslat($('sahne'));
menuKur();
