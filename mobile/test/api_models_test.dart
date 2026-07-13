import 'package:flutter_test/flutter_test.dart';
import 'package:odss_tech/api.dart';

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
    });

    expect(job.workflow, 'install');
    expect(job.action, 'start');
    expect(job.days, 1);
    expect(job.onsite, isTrue);
  });

  test('ApiError exposes a readable message', () {
    final error = ApiError('network failed', 408);
    expect(error.toString(), 'network failed');
    expect(error.status, 408);
  });
}
