import 'package:flutter/material.dart';

import '../api.dart';
import '../main.dart';

/// Bottom navigation v4 — Material NavigationBar (theme-driven, ບໍ່ມີ custom
/// animation ໜັກ — ເຄື່ອງລຸ້ນເກົ່າແລ່ນລື່ນ) · active tab ເປັນ pill ຕາມ M3.
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

  static (IconData, IconData) iconFor(String key) => switch (key) {
    'overview' => (Icons.home_outlined, Icons.home_rounded),
    'monitor' => (Icons.radar_outlined, Icons.radar_rounded),
    'techs' => (Icons.groups_outlined, Icons.groups_rounded),
    'reports' => (Icons.bar_chart_outlined, Icons.bar_chart_rounded),
    'jobs' => (Icons.work_outline_rounded, Icons.work_rounded),
    'pickup' => (Icons.local_shipping_outlined, Icons.local_shipping_rounded),
    'income' => (
      Icons.account_balance_wallet_outlined,
      Icons.account_balance_wallet_rounded,
    ),
    'qc' => (Icons.fact_check_outlined, Icons.fact_check_rounded),
    'approvals' => (Icons.verified_outlined, Icons.verified_rounded),
    'stock-count' => (Icons.inventory_2_outlined, Icons.inventory_2_rounded),
    'notifications' => (
      Icons.notifications_none_rounded,
      Icons.notifications_rounded,
    ),
    _ => (Icons.circle_outlined, Icons.circle_rounded),
  };

  @override
  Widget build(BuildContext context) => NavigationBarTheme(
    data: NavigationBarThemeData(
      height: 64,
      backgroundColor: surface,
      elevation: 0,
      // ຂອບເທິງແທນເງົາ (ປະຢັດ GPU ເຄື່ອງເກົ່າ)
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontSize: 11,
          height: 1,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w900
              : FontWeight.w600,
          color: states.contains(WidgetState.selected) ? teal : muted,
        ),
      ),
      indicatorColor: tealTint,
      indicatorShape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(999),
      ),
    ),
    child: DecoratedBox(
      // ເສັ້ນຂອບເທິງແທນເງົາ (ປະຢັດ GPU ເຄື່ອງເກົ່າ)
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: line)),
      ),
      child: NavigationBar(
        selectedIndex: selectedIndex,
        onDestinationSelected: onSelected,
        destinations: [
          for (final t in items)
            NavigationDestination(
              icon: Icon(iconFor(t.key).$1),
              selectedIcon: Icon(iconFor(t.key).$2, color: teal),
              label: t.label,
            ),
        ],
      ),
    ),
  );
}
