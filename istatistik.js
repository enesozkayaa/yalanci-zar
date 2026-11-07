// =============================================================
// Yalancı Zar - istatistikler ve rozetler
// Oyun sonunda masadakilere ödüller dağıtılır (En şanslı, Yalan makinesi, Keskin göz...).
// Bu cihazdaki oyuncunun toplam istatistikleri saklanır; belli hedeflere ulaşınca rozet kazanılır.
// =============================================================

const Istatistik = (() => {
  const ANAHTAR = 'yalanciZar.istatistik';
  const ROZETLER = [
    { id: 'ilkZafer', emoji: '🏆', ad: 'İlk Zafer', aciklama: 'Bir oyun kazan', sart: (t) => t.galibiyet >= 1 },
    { id: 'kral', emoji: '👑', ad: 'Saloon Kralı', aciklama: '10 oyun kazan', sart: (t) => t.galibiyet >= 10 },
    { id: 'emektar', emoji: '🤠', ad: 'Emektar Kovboy', aciklama: '25 oyun oyna', sart: (t) => t.oyun >= 25 },
    { id: 'temiz', emoji: '🧼', ad: 'Tertemiz', aciklama: 'Hiç zehir içmeden bir oyun kazan', sart: (t, o, kazandi) => kazandi && o && o.icti === 0 },
    { id: 'melek', emoji: '😇', ad: 'Melek', aciklama: 'Hiç yalan söylemeden bir oyun kazan', sart: (t, o, kazandi) => kazandi && o && o.yalan === 0 },
    { id: 'serif', emoji: '🕵️', ad: 'Şerif Gözü', aciklama: 'Toplam 20 yalancı yakala', sart: (t) => t.yakaladi >= 20 },
    { id: 'poker', emoji: '🃏', ad: 'Poker Yüzü', aciklama: 'Toplam 25 yalanı yutturduysan', sart: (t) => t.yutturdu >= 25 },
    { id: 'domatesci', emoji: '🍅', ad: 'Domatesçi', aciklama: 'Toplam 30 domates fırlat', sart: (t) => t.domates >= 30 },
    { id: 'nisanci', emoji: '🎯', ad: 'Keskin Nişancı', aciklama: 'Toplam 5 kez TAM bil', sart: (t) => t.tamBildi >= 5 },
    { id: 'ilkOlen', emoji: '💀', ad: 'Talihsiz', aciklama: 'Masada mumu ilk sönen ol', sart: (t, o) => o && o.olumSirasi === 1 },
  ];
  const ALANLAR = ['oyun', 'galibiyet', 'yalan', 'yakalandi', 'yakaladi', 'bosSuclama', 'yutturdu', 'icti', 'tamBildi', 'tamYanildi', 'iddia', 'domates'];

  function oku() {
    let t = null;
    try { t = JSON.parse(localStorage.getItem(ANAHTAR)); } catch (e) { /* yok */ }
    t = t && typeof t === 'object' ? t : {};
    ALANLAR.forEach(a => (t[a] = +t[a] || 0));
    t.rozetler = Array.isArray(t.rozetler) ? t.rozetler : [];
    return t;
  }
  function yaz(t) {
    try { localStorage.setItem(ANAHTAR, JSON.stringify(t)); } catch (e) { /* yok */ }
  }

  // Oyun bitti: benim istatistiklerimi topla, yeni kazanılan rozetleri döndür
  function oyunBitti(benim, kazandi) {
    const t = oku();
    t.oyun++;
    if (kazandi) t.galibiyet++;
    ['yalan', 'yakalandi', 'yakaladi', 'bosSuclama', 'yutturdu', 'icti', 'tamBildi', 'tamYanildi', 'iddia'].forEach(a => (t[a] += +benim?.[a] || 0));
    const yeni = ROZETLER.filter(r => !t.rozetler.includes(r.id) && r.sart(t, benim, kazandi));
    yeni.forEach(r => t.rozetler.push(r.id));
    yaz(t);
    return yeni;
  }
  function domatesAtildi() {
    const t = oku();
    t.domates++;
    const yeni = ROZETLER.filter(r => !t.rozetler.includes(r.id) && r.sart(t));
    yeni.forEach(r => t.rozetler.push(r.id));
    yaz(t);
    return yeni;
  }

  // Oyun sonu ödülleri: masadaki herkes arasından
  function oduller(istat, ayar) {
    const liste = [];
    const enCok = (alan, emoji, ad, aciklama) => {
      const max = Math.max(...istat.map(p => p[alan] || 0));
      if (max <= 0) return;
      const kim = istat.filter(p => (p[alan] || 0) === max);
      liste.push({ emoji, ad, kim: kim.map(p => p.ad).join(', '), aciklama: aciklama(max) });
    };
    const temiz = istat.filter(p => (p.icti || 0) === 0);
    if (temiz.length && temiz.length < istat.length) liste.push({ emoji: '🍀', ad: 'En şanslı', kim: temiz.map(p => p.ad).join(', '), aciklama: 'Hiç zehir içmedi' });
    const ilk = istat.find(p => p.olumSirasi === 1);
    if (ilk) liste.push({ emoji: '💀', ad: 'En şanssız', kim: ilk.ad, aciklama: 'Zehre ilk dayanamayan' });
    enCok('yalan', '🤥', 'Yalan makinesi', n => `${n} kez tutmayan iddiada bulundu`);
    enCok('yakalandi', '🚔', 'En çok yakalanan', n => `${n} kez yalanı yakalandı`);
    enCok('yakaladi', '🕵️', 'Keskin göz', n => `${n} yalancı yakaladı`);
    enCok('yutturdu', '🃏', 'Blöf ustası', n => `${n} yalanı kimse fark etmedi`);
    enCok('bosSuclama', '🙈', 'Boşa suçlayan', n => `${n} kez doğru söyleyeni suçladı`);
    if (ayar?.tam) enCok('tamBildi', '🎯', 'Keskin nişancı', n => `${n} kez TAM bildi`);
    enCok('iddia', '📢', 'Geveze', n => `${n} iddiada bulundu`);
    return liste;
  }

    function paneliCiz() {
    const t = oku();
    const oran = t.oyun ? Math.round((t.galibiyet / t.oyun) * 100) : 0;
    const kutu = (deger, ad) => `<div class="istKutu"><b>${deger}</b><small>${ad}</small></div>`;
    $('istatistikIcerik').innerHTML = `<div class="istIzgara">${kutu(t.oyun, 'Oyun')}${kutu(t.galibiyet, 'Galibiyet')}${kutu('%' + oran, 'Kazanma')}`
      + `${kutu(t.yalan, 'Yalan')}${kutu(t.yutturdu, 'Yutturulan yalan')}${kutu(t.yakalandi, 'Yakalandın')}`
      + `${kutu(t.yakaladi, 'Yakaladın')}${kutu(t.bosSuclama, 'Boşa suçlama')}${kutu(t.icti, 'İçilen zehir')}`
      + `${kutu(t.tamBildi + '/' + (t.tamBildi + t.tamYanildi), 'TAM bilinen')}${kutu(t.domates, 'Domates')}${kutu(t.iddia, 'İddia')}</div>`
      + `<h3>Rozetler (${t.rozetler.length}/${ROZETLER.length})</h3><div class="rozetler">`
      + ROZETLER.map(r => `<div class="rozet${t.rozetler.includes(r.id) ? ' var' : ''}"><span>${r.emoji}</span><b>${r.ad}</b><small>${r.aciklama}</small></div>`).join('')
      + '</div>';
  }
  $('istatistikBtn').addEventListener('click', () => {
    paneliCiz();
    $('istatistikPaneli').hidden = false;
  });
  $('istatistikKapat').addEventListener('click', () => ($('istatistikPaneli').hidden = true));

  return { oyunBitti, domatesAtildi, oduller };
})();
