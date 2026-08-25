import 'package:flutter_test/flutter_test.dart';
import 'package:odss_tech/app_update.dart';

void main() {
  test('ອ່ານນະໂຍບາຍອັບເດດຈາກ server (426 / login)', () {
    final info = AppUpdateInfo.fromJson({
      'force_update': true,
      'update_available': true,
      'min_version': '1.12.0+34',
      'latest_version': '1.12.0+34',
      'current_version': '1.11.0+33',
      'update_url': '/downloads/ods.apk',
    });
    expect(info.forceUpdate, isTrue);
    expect(info.latestVersion, '1.12.0+34');
    expect(info.updateUrl, '/downloads/ods.apk');
  });

  test('ຂາດ field = ບໍ່ບັງຄັບ (ຢ່າບລັອກຊ່າງເພາະຄຳຕອບບໍ່ຄົບ)', () {
    const empty = AppUpdateInfo();
    expect(empty.forceUpdate, isFalse);
    expect(AppUpdateInfo.fromJson(const {}).forceUpdate, isFalse);
  });

  test('ລິ້ງອັບເດດແບບ path ຕໍ່ກັບ server ທີ່ແອັບໃຊ້ຢູ່', () {
    final url = AppUpdater.resolveUrl(
      '/downloads/ods.apk',
      baseUrl: 'https://ods.odienmall.com',
    );
    expect(url.toString(), 'https://ods.odienmall.com/downloads/ods.apk');

    // ຊ່າງຊີ້ server ພາຍໃນ ⇒ ໂຫຼດ APK ຈາກ server ອັນນັ້ນ ບໍ່ແມ່ນ server ນອກ
    final local = AppUpdater.resolveUrl(
      '/downloads/ods.apk',
      baseUrl: 'http://192.168.1.51:3000',
    );
    expect(local.toString(), 'http://192.168.1.51:3000/downloads/ods.apk');
  });

  test('ລິ້ງເຕັມໃຊ້ຕາມນັ້ນ · ຫວ່າງ = null', () {
    expect(
      AppUpdater.resolveUrl('https://cdn.example/ods.apk', baseUrl: 'https://a.b')
          .toString(),
      'https://cdn.example/ods.apk',
    );
    expect(AppUpdater.resolveUrl('', baseUrl: 'https://a.b'), isNull);
    expect(AppUpdater.resolveUrl('/ods.apk', baseUrl: ''), isNull);
  });

  test('ຮູ້ແລ້ວວ່າຕ້ອງອັບເດດ ⇒ ຄຳຕອບຕໍ່ມາປົດການບລັອກບໍ່ໄດ້', () {
    appUpdate.value = null;
    reportAppUpdate(const AppUpdateInfo(forceUpdate: true, latestVersion: '2.0.0'));
    // ບາງ route ຕອບກັບມາຊ້າ ຫຼື ຜ່ານ cache ⇒ ຢ່າໃຫ້ໜ້າຈໍກະພິບເຂົ້າ-ອອກ
    reportAppUpdate(const AppUpdateInfo(forceUpdate: false));
    expect(appUpdate.value?.forceUpdate, isTrue);
    appUpdate.value = null;
  });
}
