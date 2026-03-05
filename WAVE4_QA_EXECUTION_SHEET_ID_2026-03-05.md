# Lembar Eksekusi QA Wave 4

Tanggal: ____________  
Tester: ____________  
Environment: ☐ Local ☐ Staging ☐ Production  
Build/Commit: ____________  

## 1) Urutan Eksekusi (Disarankan)
1. Documents
2. Finance
3. Supply Chain
4. Portfolio Analytics
5. Project Management
6. Timeline

## 2) Matriks Lulus/Gagal

| Modul | Skenario | Hasil | Catatan |
|---|---|---|---|
| Documents | Query + kategori + uploader + rentang tanggal digabung | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Documents | Reset Filters mengosongkan kontrol advanced dengan benar | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Documents | State filter tetap tersimpan setelah refresh | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Finance (AP) | Query/status/sort + vendor + rentang jatuh tempo digabung | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Finance (AR) | Query/status/sort + rentang periode digabung | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Finance | Reset AP/AR berjalan dan tidak merusak toolbar utama | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Supply Chain (Requests) | Query/status/sort + requester + rentang required date | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Supply Chain (Orders) | Query/status/sort + vendor + rentang created date | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Supply Chain | Reset per-tab berjalan sesuai tab aktif | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Portfolio Analytics | Query/health/sort + status + owner + rentang end date | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Portfolio Analytics | Date filter mengecualikan baris tanpa end date saat range aktif | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Project Management | Query/status/sort + owner + rentang deadline | ☐ PASS ☐ FAIL ☐ BLOCKED | |
| Timeline | Query/status + resource + rentang start date | ☐ PASS ☐ FAIL ☐ BLOCKED | |

## 3) Cek Cepat Aksesibilitas & UX
- [ ] Navigasi keyboard menjangkau semua kontrol advanced
- [ ] Label kontrol jelas dan sesuai fungsi
- [ ] Jumlah hasil ter-update setelah perubahan filter
- [ ] Tidak ada layout rusak di desktop/tablet/mobile

## 4) Cek Cepat Regression
- [ ] Tidak ada console error saat pindah tab dan ganti filter berulang
- [ ] Alur create/edit/delete existing tetap berjalan di modul yang disentuh
- [ ] Persistensi refresh (localStorage) sesuai ekspektasi

## 5) Keputusan Akhir
- Overall: ☐ PASS ☐ FAIL ☐ BLOCKED
- Jumlah defect critical: ____
- Jumlah defect major: ____
- Jumlah defect minor: ____

## 6) Log Defect
1. ID: ____ | Modul: ____ | Severity: ____ | Ringkasan: __________________
2. ID: ____ | Modul: ____ | Severity: ____ | Ringkasan: __________________
3. ID: ____ | Modul: ____ | Severity: ____ | Ringkasan: __________________

## 7) Sign-off
QA Lead: __________________  
Product Owner: __________________  
Tanggal: __________________
