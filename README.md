# PDKS — Personel Devam Kontrol Sistemi

QR kod ile personel giriş/çıkış takibi. Next.js + Supabase ile geliştirildi,
PWA olarak Android/iPhone tarayıcısından kurulum yapılabilir. Barındırma ve
veritabanı ücretsiz katmanlarla küçük bir atölye/ofis için yeterlidir.

## Özellikler

- Her personel için benzersiz QR kod (indirilebilir PNG)
- Kamera ile QR okutma; giriş/çıkış otomatik algılanır
- Geç kalma / erken çıkış otomatik işaretleme (tolerans ayarlanabilir)
- Yönetici paneli: günlük durum, personel yönetimi, günlük/haftalık/aylık raporlar
- CSV ve Excel dışa aktarma
- Opsiyonel GPS doğrulama (işyeri konumunun X metre yakınında olma zorunluluğu)
- PWA: "Ana Ekrana Ekle" ile uygulama gibi çalışır, offline kabuk cache'i vardır

## 1) Supabase Kurulumu (5 dakika)

1. [supabase.com](https://supabase.com) üzerinden ücretsiz bir proje oluşturun.
2. Sol menüden **SQL Editor** açın, bu depodaki `supabase/schema.sql`
   dosyasının tamamını yapıştırıp **Run** deyin. Bu, tüm tabloları oluşturur.
3. **Project Settings → API** sayfasından şu üç değeri kopyalayın:
   - `Project URL`
   - `anon` `public` key
   - `service_role` key (gizli, kimseyle paylaşmayın)
4. **Authentication → Users → Add user** ile kendinize bir yönetici hesabı
   oluşturun (e-posta + şifre). Bu, admin paneline giriş için kullanılacak
   tek kimlik doğrulama yöntemidir.

## 2) Projeyi Çalıştırma

```bash
npm install
cp .env.example .env.local
# .env.local dosyasını Supabase bilgilerinizle doldurun
npm run dev
```

Tarayıcıda `http://localhost:3000` — çalışan QR okutma ekranı.
`http://localhost:3000/admin` — yönetici paneli girişi.

## 3) Yayına Alma (Vercel — ücretsiz katman yeterli)

1. Bu klasörü bir GitHub deposuna yükleyin.
2. [vercel.com](https://vercel.com) üzerinden depoyu import edin.
3. Environment Variables kısmına `.env.local` içindeki 3 değeri girin.
4. Deploy edin. Vercel size `https://xxx.vercel.app` adresi verir — bu adres
   HTTPS olduğu için kamera erişimi (QR okuma) ve konum servisleri sorunsuz
   çalışır (tarayıcılar kamerayı yalnızca HTTPS üzerinde açık zorunlu kılar).

## 4) Kullanım Akışı

1. **Personel ekle:** Admin → Personel → ad soyad girip "Ekle".
2. **QR kartlarını yazdır:** Admin → Personel → "QR Kartları" görünümü →
   her personelin QR'ını PNG olarak indirip yazdırın / laminasyon yapın.
3. **Giriş/çıkış:** Personel telefon tarayıcısında ana sayfayı (`/`) açar,
   kamera izni verir, kartını okutur. İlk okutma "giriş", aynı gün ikinci
   okutma otomatik olarak "çıkış" sayılır.
4. **Takip:** Admin → Panel'de günlük durumu, Admin → Raporlar'da haftalık/
   aylık toplam çalışma saatlerini ve CSV/Excel çıktısını görürsünüz.
5. **Ayarlar:** Admin → Ayarlar'dan mesai saatlerini, geç/erken tolerans
   sürelerini ve isterseniz GPS zorunluluğunu (işyeri konumu + yarıçap)
   tanımlayın.

## Mimari Notlar

- Tüm veritabanı yazma/okuma işlemleri **sunucu tarafında** (`pages/api/*`)
  Supabase **service role key** ile yapılır. Tarayıcıya yalnızca `anon key`
  gönderilir ve bu key sadece Supabase Auth (yönetici girişi) için kullanılır.
  Bu sayede RLS politikası basit tutulabilir: anon key ile veritabanına
  doğrudan erişim tamamen kapalıdır.
- Admin API route'ları isteğin `Authorization: Bearer <access_token>`
  header'ını Supabase Auth ile doğrular (`lib/requireAdmin.js`).
- Giriş/çıkış algılama mantığı: günün son kaydı "çıkış" ise veya hiç kayıt
  yoksa → yeni okutma "giriş" sayılır; son kayıt "giriş" ise → yeni okutma
  "çıkış" sayılır. Aynı tip art arda okutulursa hata mesajı gösterilir.
- Çalışma süresi, bir "çıkış" kaydı oluşturulurken o güne ait son "giriş"
  kaydıyla arasındaki farktan hesaplanır.

## Genişletme Fikirleri (opsiyonel, dahil değil)

- Vardiya bazlı çoklu mesai saatleri (gece vardiyası vb.)
- Personel öz-hizmet ekranı (kendi geçmiş kayıtlarını görme)
- E-posta/SMS ile günlük özet bildirimi
- Yüz tanıma veya NFC kart entegrasyonu

## Simge Notu

`public/icons/` altındaki `icon-192.png` ve `icon-512.png` yer tutucu
olarak oluşturulmuştur. Gerçek kullanım öncesi kendi logonuzla değiştirmenizi
öneririz.
