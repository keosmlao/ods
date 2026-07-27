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
