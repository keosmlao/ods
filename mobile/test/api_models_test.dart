import 'package:flutter_test/flutter_test.dart';
import 'package:odss_tech/api.dart';
import 'package:odss_tech/link_target.dart';

void main() {
  test('Job parses server-driven workflow fields', () {
    final job = Job.fromJson({
      'workflow': 'install',
      'code': 'INST-1',
      'customer': 'Customer',
      'tel': '02055555555',
      'address': 'Vientiane',
      'product': 'TV',
      'detail': 'Model A',
      'onsite': true,
      'stage': 4,
      'stage_label': 'ລໍຖ້າຕິດຕັ້ງ',
      'elapsed_seconds': 86400,
      'appointment': '13-07-2026',
      'action': 'start',
      'checked_in': false,
      'accepted': true,
      'has_checked_in': true,
      'has_checked_out': false,
      'can_check_in': false,
      'can_check_out': true,
      'lat': 17.9757,
      'lng': 102.6331,
      'visit_rounds': 2,
    });

    expect(job.workflow, 'install');
    expect(job.action, 'start');
    expect(job.days, 1);
    expect(job.onsite, isTrue);
    expect(job.accepted, isTrue);
    expect(job.hasCheckedIn, isTrue);
    expect(job.canCheckOut, isTrue);
    expect(job.lat, 17.9757);
    expect(job.lng, 102.6331);
    // ໄປມາແລ້ວ 2 ຮອບ ⇒ ບັດງານໃນຄິວຂຶ້ນປ້າຍ "ຮອບທີ 3"
    expect(job.visitRounds, 2);
  });

  test('timeline carries site-visit rounds (1 ໃບງານ = ຫຼາຍຮອບ)', () {
    final timeline = JobTimelineData.fromJson({
      'cancelled_at': null,
      'steps': [
        {
          'stage': 5,
          'label': 'ກຳລັງຕິດຕັ້ງ',
          'at': '25-06-2026 13:29',
          'duration_seconds': 120,
          'state': 'current',
        },
      ],
      'visits': [
        {
          'n': 1,
          'tech': 'ສັກດາ',
          'at': '07-08-2026 13:56',
          'out': '07-08-2026 14:02',
          'minutes': 6,
        },
        // ຮອບທີ່ຊ່າງຍັງບໍ່ໄດ້ check-out — ຄວາມຍາວຍັງບໍ່ຮູ້
        {
          'n': 2,
          'tech': 'ສັກດາ',
          'at': '09-08-2026 15:09',
          'out': null,
          'minutes': null,
          'reason': 'ລໍງານໄຟຟ້າ',
        },
      ],
    });

    expect(timeline.steps.single.isCurrent, isTrue);
    expect(timeline.visits.length, 2);
    expect(timeline.visits.first.lengthLabel, '6 ນທ');
    expect(timeline.visits.last.out, isNull);
    expect(timeline.visits.last.lengthLabel, '-');
    // ເຫດຜົນຕິດຢູ່ຮອບຫຼ້າສຸດ — ແຖບເຕືອນເທິງສຸດຂອງໜ້າໃບງານດຶງຈາກນີ້
    expect(timeline.visits.first.reason, isNull);
    expect(timeline.visits.last.reason, 'ລໍງານໄຟຟ້າ');
    // ງານສ້ອມບໍ່ສົ່ງ visits ມາ ⇒ ຕ້ອງບໍ່ພັງ ແລະ ບໍ່ສະແດງແຖບຮອບ
    expect(JobTimelineData.fromJson({'steps': []}).visits, isEmpty);
  });

  test('ApiError exposes a readable message', () {
    final error = ApiError('network failed', 408);
    expect(error.toString(), 'network failed');
    expect(error.status, 408);
  });

  test('notification and FCM payloads resolve to the same job target', () {
    final inbox = linkTargetFrom({'model': 'tb_product', 'res_id': 'SV-001'});
    final push = linkTargetFrom({'workflow': 'repair', 'code': 'SV-001'});
    final camel = linkTargetFrom({'model': 'ods_tb_install', 'resId': 'IN-002'});

    expect(inbox?.workflow, 'repair');
    expect(inbox?.code, 'SV-001');
    expect(push?.workflow, 'repair');
    expect(push?.code, 'SV-001');
    expect(camel?.workflow, 'install');
    expect(camel?.code, 'IN-002');
    expect(linkTargetFrom({'model': 'ic_trans', 'res_id': 'PO-1'}), isNull);
  });
}
