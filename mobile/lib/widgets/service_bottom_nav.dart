import 'package:flutter/material.dart';

import '../api.dart';

/// Bottom navigation ແບບກະທັດຮັດ: ພື້ນຂາວຄົງທີ່ ແລະ active tab ເປັນ pill.
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

  static const active = Color(0xFF0F766E);
  static const inactive = Color(0xFF64748B);

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
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: Colors.white,
      border: const Border(top: BorderSide(color: Color(0xFFE2E8F0))),
      boxShadow: [
        BoxShadow(
          color: const Color(0xFF0F172A).withValues(alpha: .08),
          blurRadius: 20,
          offset: const Offset(0, -5),
        ),
      ],
    ),
    child: SafeArea(
      top: false,
      minimum: const EdgeInsets.fromLTRB(8, 7, 8, 7),
      child: Row(
        children: [
          for (var i = 0; i < items.length; i++)
            Expanded(
              child: _NavItem(
                item: items[i],
                selected: i == selectedIndex,
                onTap: () => onSelected(i),
              ),
            ),
        ],
      ),
    ),
  );
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.item,
    required this.selected,
    required this.onTap,
  });
  final NavTab item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final icons = ServiceBottomNav.iconFor(item.key);
    return Semantics(
      selected: selected,
      button: true,
      label: item.label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(15),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
          margin: const EdgeInsets.symmetric(horizontal: 2),
          padding: const EdgeInsets.symmetric(vertical: 7),
          decoration: BoxDecoration(
            color: selected
                ? ServiceBottomNav.active.withValues(alpha: .1)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(15),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                width: selected ? 32 : 28,
                height: 27,
                decoration: BoxDecoration(
                  color: selected
                      ? ServiceBottomNav.active
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  selected ? icons.$2 : icons.$1,
                  size: selected ? 18 : 20,
                  color: selected ? Colors.white : ServiceBottomNav.inactive,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                item.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 9.5,
                  height: 1,
                  color: selected
                      ? ServiceBottomNav.active
                      : ServiceBottomNav.inactive,
                  fontWeight: selected ? FontWeight.w900 : FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
