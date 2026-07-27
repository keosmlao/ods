import 'package:flutter/material.dart';

import 'api.dart';
import 'link_target.dart';
import 'screens/job_screen.dart';
import 'screens/manager_kit.dart';

class AppLinks {
  static Map<String, dynamic>? _pending;

  static Future<void> openPushData(Map<String, dynamic> data) async {
    final target = linkTargetFrom(data);
    if (target == null) return;
    await openJob(target.workflow, target.code, fallback: data);
  }

  static Future<void> openRecord(String model, String resId) async {
    final data = {'model': model, 'res_id': resId};
    if (linkTargetFrom(data) == null) {
      _message('ເອກະສານ $resId ຍັງບໍ່ມີໜ້າລາຍລະອຽດໃນແອັບ');
      return;
    }
    await openPushData(data);
  }

  static Future<void> openJob(String workflow, String code, {Map<String, dynamic>? fallback}) async {
    final nav = navigatorKey.currentState;
    if (nav == null) {
      _pending = fallback ?? {'workflow': workflow, 'code': code};
      return;
    }
    try {
      final jobs = await Api.jobs();
      final matches = jobs.where((job) => job.workflow == workflow && job.code == code);
      if (matches.isEmpty) {
        _message('ບໍ່ພົບວຽກ $code ໃນຄິວຂອງທ່ານ');
        return;
      }
      await nav.push(MaterialPageRoute(builder: (_) => JobScreen(job: matches.first)));
    } on ApiError catch (error) {
      if (error.status == 403) {
        try {
          final groups = await Api.monitor();
          final matches = groups.expand((group) => group.jobs).where(
                (job) => job.workflow == workflow && job.code == code,
              );
          if (matches.isNotEmpty && nav.mounted) {
            showJobSheet(nav.context, matches.first);
            return;
          }
        } catch (_) {}
      }
      _message(error.message);
    } catch (_) {
      _message('ເປີດວຽກ $code ບໍ່ສຳເລັດ');
    }
  }

  static Future<void> flush() async {
    final data = _pending;
    _pending = null;
    if (data != null) await openPushData(data);
  }

  static void _message(String text) {
    final context = navigatorKey.currentContext;
    if (context != null) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }
}
