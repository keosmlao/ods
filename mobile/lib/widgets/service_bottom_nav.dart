import 'package:animated_bottom_navigation_bar/animated_bottom_navigation_bar.dart';
import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';

/// ແຖບລຸ່ມແບບ **ໄດນາມິກ + ມີ animation** — item ມາຈາກ manifest ຂອງ role
/// (server ສົ່ງມາຕອນ login). ໃຊ້ package animated_bottom_navigation_bar ໃຫ້ icon
/// ຂຶ້ນ-ລົງ ຕອນສະຫຼັບ tab. NavHost ຄຸມ index ໃຫ້.
///
/// ໝາຍເຫດ: package ຮອງຮັບ 2–5 tab. role ທີ່ມີ tab ດຽວ NavHost ບໍ່ສະແດງແຖບຢູ່ແລ້ວ.
class ServiceBottomNav extends StatelessWidget {
  const ServiceBottomNav({
    super.key,
    required this.items,
    required this.selectedIndex,
    required this.onSelected,
  });

  final List<NavTab> items;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  /// (icon ຕອນບໍ່ເລືອກ, icon ຕອນເລືອກ) ຕາມ key
  static (IconData, IconData) iconFor(String key) => switch (key) {
    'overview' => (Icons.dashboard_outlined, Icons.dashboard_rounded),
    'jobs' => (Icons.work_outline_rounded, Icons.work_rounded),
    'pickup' => (Icons.inventory_2_outlined, Icons.inventory_2_rounded),
    'income' => (Icons.payments_outlined, Icons.payments_rounded),
    'qc' => (Icons.fact_check_outlined, Icons.fact_check_rounded),
    'approvals' => (Icons.verified_outlined, Icons.verified_rounded),
    'stock-count' => (
      Icons.qr_code_scanner_rounded,
      Icons.qr_code_scanner_rounded,
    ),
    'notifications' => (
      Icons.notifications_none_rounded,
      Icons.notifications_rounded,
    ),
    _ => (Icons.circle_outlined, Icons.circle),
  };

  @override
  Widget build(BuildContext context) => AnimatedBottomNavigationBar.builder(
    itemCount: items.length,
    activeIndex: selectedIndex,
    onTap: onSelected,
    height: 68,
    elevation: 16,
    backgroundColor: ink, // v2: ແຖບ ink ເຂັ້ມ ລອຍ
    splashColor: tealBright,
    splashSpeedInMilliseconds: 240,
    leftCornerRadius: 24,
    rightCornerRadius: 24,
    gapLocation: GapLocation.none, // ບໍ່ມີ FAB ⇒ ບໍ່ໃຫ້ເວັ້ນຊ່ອງ
    shadow: const Shadow(
      color: Color(0x400A1A16),
      blurRadius: 26,
      offset: Offset(0, 8),
    ),
    tabBuilder: (index, isActive) {
      final item = items[index];
      final icons = iconFor(item.key);
      final color = isActive ? tealBright : Colors.white.withValues(alpha: .45);
      return Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(isActive ? icons.$2 : icons.$1, size: 24, color: color),
          const SizedBox(height: 4),
          Text(
            item.label,
            overflow: TextOverflow.fade,
            softWrap: false,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ],
      );
    },
  );
}
