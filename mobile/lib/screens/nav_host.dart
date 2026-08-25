import 'package:flutter/material.dart';

import '../api.dart';
import '../widgets/service_bottom_nav.dart';
import 'income_screen.dart';
import 'rank_screen.dart';
import 'today_screen.dart';
import 'jobs_screen.dart';
import 'manager_screen.dart';
import 'monitor_screen.dart';
import 'notifications_screen.dart';
import 'pickup_screen.dart';
import 'approvals_screen.dart';
import 'qc_screen.dart';
import 'reports_screen.dart';
import 'stock_count_screen.dart';
import 'techs_screen.dart';

/// ໂຄງແອັບຫຼັກ — ແຖບລຸ່ມຕາມ role (server ສົ່ງ `tabs` ມາຕອນ login).
///
/// ແຕ່ລະໜ້າ tab ຍັງເປັນ Scaffold ຂອງໂຕເອງ (AppBar + body) — host ພຽງໃສ່ແຖບລຸ່ມ
/// ໃຫ້ບ່ອນດຽວ ແລ້ວສະຫຼັບດ້ວຍ IndexedStack ⇒ ໜ້າທີ່ຖືກ push ເປັນ detail (ເຊັ່ນ
/// stock-balance ຈາກເມນູ jobs) ຍັງໃຊ້ໄດ້ຄືເກົ່າ ເພາະບໍ່ໄດ້ແກ້ໜ້າພາຍໃນ.
class NavHost extends StatefulWidget {
  const NavHost({super.key, required this.tabs});

  final List<NavTab> tabs;

  @override
  State<NavHost> createState() => _NavHostState();
}

class _NavHostState extends State<NavHost> {
  int index = 0;

  static Widget _screen(String key) => switch (key) {
    'today' => const TodayScreen(),
    'rank' => const RankScreen(),
    'overview' => const ManagerScreen(),
    'monitor' => const MonitorScreen(),
    'techs' => const TechsScreen(),
    'reports' => const ReportsScreen(),
    'jobs' => const JobsScreen(),
    'pickup' => const PickupScreen(),
    'income' => const IncomeScreen(),
    'qc' => const QcScreen(),
    'approvals' => const ApprovalsScreen(),
    'stock-count' => const StockCountScreen(),
    'notifications' => const NotificationsScreen(),
    _ => const _Unsupported(),
  };

  @override
  Widget build(BuildContext context) {
    // ຢ່າງໜ້ອຍ 1 tab ສະເໝີ (fallback ຕອນ manifest ວ່າງ)
    final tabs = widget.tabs.isEmpty
        ? [NavTab(key: 'notifications', label: 'ແຈ້ງເຕືອນ')]
        : widget.tabs;
    final active = index.clamp(0, tabs.length - 1);
    return Scaffold(
      body: IndexedStack(
        index: active,
        children: tabs.map((t) => _screen(t.key)).toList(),
      ),
      // role ທີ່ມີ tab ດຽວ (ເຊັ່ນ user) — ບໍ່ຕ້ອງມີແຖບລຸ່ມ
      bottomNavigationBar: tabs.length < 2
          ? null
          : ServiceBottomNav(
              items: tabs,
              selectedIndex: active,
              onSelected: (i) => setState(() => index = i),
            ),
    );
  }
}

class _Unsupported extends StatelessWidget {
  const _Unsupported();

  @override
  Widget build(BuildContext context) => const Scaffold(
    body: Center(child: Text('ໜ້ານີ້ຍັງບໍ່ຮອງຮັບໃນແອັບ')),
  );
}
