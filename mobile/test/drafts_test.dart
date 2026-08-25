import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:odss_tech/drafts.dart';

/// ພິສູດວ່າ **ຮູບທີ່ແນບໄວ້ບໍ່ຫາຍ** ເມື່ອຊ່າງອອກຈາກໜ້າຈໍ ຫຼື ອອກຈາກແອັບ.
///
/// ນີ້ຄືອາການທີ່ຊ່າງແຈ້ງມາເລື້ອຍໆ: ຖ່າຍໄປ 4 ຮູບ ແລ້ວກົດອອກໄປເບິ່ງໜ້າອື່ນ
/// ພໍກັບມາຮູບຫາຍໝົດ ຕ້ອງຖ່າຍໃໝ່ ທັງທີ່ບາງເທື່ອເຄື່ອງລູກຄ້າຖືກປະກອບຄືນແລ້ວ.
void main() {
  late Directory folder;

  setUp(() async {
    folder = await Directory.systemTemp.createTemp('odss-drafts');
    Drafts.forgetInMemory();
    await Drafts.load(folder: folder);
  });

  tearDown(() async {
    if (folder.existsSync()) await folder.delete(recursive: true);
  });

  test('ຮູບທີ່ແນບໄວ້ ຍັງຢູ່ຫຼັງ "ເປີດແອັບໃໝ່"', () async {
    Drafts.write('check:7742', {
      'photos': ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'],
      'diagnosis': 'ໄຟບໍ່ເຂົ້າ',
    });
    await Drafts.flushForTest();

    // ຈຳລອງ: ແອັບຖືກຂ້າ (RAM ຫາຍ) ແລ້ວເປີດຄືນ ⇒ ອ່ານຈາກໄຟລ໌
    Drafts.forgetInMemory();
    expect(Drafts.photos('check:7742'), isEmpty);
    await Drafts.load(folder: folder);

    expect(Drafts.photos('check:7742'), hasLength(2));
    expect(Drafts.read('check:7742')['diagnosis'], 'ໄຟບໍ່ເຂົ້າ');
  });

  test('ສົ່ງສຳເລັດ ⇒ ຮ່າງຖືກລຶບ (ຮູບເກົ່າບໍ່ໂຜ່ຄືນຮອບໜ້າ)', () async {
    Drafts.write('check:7742', {'photos': ['data:image/jpeg;base64,AAA']});
    await Drafts.flushForTest();
    Drafts.clear('check:7742');
    await Drafts.flushForTest();

    Drafts.forgetInMemory();
    await Drafts.load(folder: folder);
    expect(Drafts.photos('check:7742'), isEmpty);
  });

  test('ຮ່າງແຍກກັນຕໍ່ໃບງານ — ໃບໜຶ່ງບໍ່ທັບອີກໃບ', () async {
    Drafts.write('check:7742', {'photos': ['A']});
    Drafts.write('job:repair:7715', {'photos': ['B', 'C'], 'note': 'ລໍອາໄຫຼ່'});
    await Drafts.flushForTest();

    Drafts.forgetInMemory();
    await Drafts.load(folder: folder);
    expect(Drafts.photos('check:7742'), ['A']);
    expect(Drafts.photos('job:repair:7715'), ['B', 'C']);
    expect(Drafts.read('job:repair:7715')['note'], 'ລໍອາໄຫຼ່');
  });
}
