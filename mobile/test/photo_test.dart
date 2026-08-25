import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:odss_tech/photo.dart';

void main() {
  test('ຮູບນ້ອຍ ⇒ ບໍ່ບີບ ແລະ ຄືນເປັນ data-URI', () async {
    // ຮູບຈຳລອງນ້ອຍໆ — ຢູ່ໃຕ້ເພດານຢູ່ແລ້ວ ⇒ ບໍ່ຕ້ອງເອີ້ນຕົວບີບ (plugin ບໍ່ມີໃນເທສ)
    final bytes = Uint8List.fromList(List.filled(1000, 7));
    final uri = await Photo.encode(bytes);
    expect(uri.startsWith('data:image/jpeg;base64,'), isTrue);
    expect(base64Decode(uri.split(',').last).length, 1000);
  });

  test('ເພດານຕ່ຳກວ່າ server (400,000) ⇒ ມີບ່ອນເຜື່ອ', () {
    // ດ່ານຈິງຢູ່ src/lib/mobile-auth.ts (MAX_PHOTO_CHARS). ຖ້າມີໃຜຍົກເພດານແອັບ
    // ໃຫ້ເທົ່າ ຫຼື ເກີນ server ຮູບຈະຖືກ 413 ຄືນອີກ ⇒ ເທສນີ້ກັ້ນໄວ້.
    expect(Photo.maxChars, lessThan(400000));
  });
}
