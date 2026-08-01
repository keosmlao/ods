import 'package:animated_bottom_navigation_bar/animated_bottom_navigation_bar.dart';
import 'package:flutter/material.dart';
import '../api.dart';

/// ແຖບລຸ່ມແບບໄດນາມິກ + ມີ animation ທີ່ທັນສະໄໝ
/// ອອກແບບໃຫ້ດູທັນສະໄໝ ດ້ວຍ glass-morphism effect ແລະ active indicator
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

  /// ຊຸດສີຫຼັກຂອງແອັບ
  static const Color _primaryBlue = Color(0xFF38BDF8);
  // ສີໄລ່ລະດັບຂອງເສັ້ນຊີ້ຕຳແໜ່ງ — ຟ້າ → ມ່ວງ
  static const Color _gradientStart = Color(0xFF38BDF8);
  static const Color _gradientEnd = Color(0xFF818CF8);
  
  /// ກຳນົດຄູ່ໄອຄອນ (ບໍ່ເລືອກ, ເລືອກ)
  static (IconData, IconData) iconFor(String key) => switch (key) {
    'overview' => (Icons.home_outlined, Icons.home_rounded),
    'monitor' => (Icons.radar_outlined, Icons.radar),
    'techs' => (Icons.person_outline_rounded, Icons.person_rounded),
    'reports' => (Icons.bar_chart_outlined, Icons.bar_chart_rounded),
    'jobs' => (Icons.work_outline_rounded, Icons.work_rounded),
    'pickup' => (Icons.local_shipping_outlined, Icons.local_shipping_rounded),
    'income' => (Icons.attach_money_outlined, Icons.attach_money_rounded),
    'qc' => (Icons.checklist_outlined, Icons.checklist_rounded),
    'approvals' => (Icons.verified_outlined, Icons.verified_rounded),
    'stock-count' => (
      Icons.inventory_outlined,
      Icons.inventory_rounded,
    ),
    'notifications' => (
      Icons.notifications_outlined,
      Icons.notifications_rounded,
    ),
    _ => (Icons.circle_outlined, Icons.circle_rounded),
  };

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        /// Glass-morphism effect
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? [
                  Colors.white.withValues(alpha: 0.08),
                  Colors.white.withValues(alpha: 0.02),
                ]
              : [
                  Colors.white.withValues(alpha: 0.85),
                  Colors.white.withValues(alpha: 0.95),
                ],
        ),
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(
            color: isDark 
                ? Colors.black.withValues(alpha: 0.4)
                : Colors.black.withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, 4),
            spreadRadius: 0,
          ),
          BoxShadow(
            color: _primaryBlue.withValues(alpha: 0.1),
            blurRadius: 30,
            offset: const Offset(0, -2),
            spreadRadius: 0,
          ),
        ],
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.1)
              : Colors.white.withValues(alpha: 0.5),
          width: 0.5,
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(32),
        child: AnimatedBottomNavigationBar.builder(
          itemCount: items.length,
          activeIndex: selectedIndex,
          onTap: onSelected,
          height: 72,
          elevation: 0, // ຍ້າຍ shadow ໄປໃສ່ container ແລ້ວ
          backgroundColor: Colors.transparent, // ໃຊ້ glass effect
          splashColor: _primaryBlue.withValues(alpha: 0.15),
          splashSpeedInMilliseconds: 300,
          leftCornerRadius: 0,
          rightCornerRadius: 0,
          gapLocation: GapLocation.none,
          shadow: const Shadow(blurRadius: 0), // ບໍ່ໃຊ້ shadow ຂອງ package

          /**
           * ⚠️ **ບໍ່ມີ `activeTabIndicator`** ໃນ animated_bottom_navigation_bar 1.4.0
           * (ເບິ່ງ AnimatedBottomNavigationBar.builder ຂອງ package) ⇒ ໃສ່ໄປ build ບໍ່ຜ່ານ.
           * ເສັ້ນຊີ້ຕຳແໜ່ງແຕ້ມເອງຢູ່ໃນ `tabBuilder` ຢູ່ແລ້ວ (ຂ້າງລຸ່ມ) ເຊິ່ງດີກວ່າ:
           * ບໍ່ຜູກກັບ API ຂອງ package ⇒ ອັບເກຣດ/ດາວເກຣດ package ແລ້ວບໍ່ພັງ.
           */
          tabBuilder: (index, isActive) {
            final item = items[index];
            final icons = iconFor(item.key);
            final isSelected = index == selectedIndex;
            
            return AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeOutCubic,
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  /// ໄອຄອນພ້ອມ animation scale
                  _buildAnimatedIcon(
                    icon: isActive ? icons.$2 : icons.$1,
                    isActive: isActive,
                    index: index,
                  ),
                  const SizedBox(height: 4),
                  
                  /// ຂໍ້ຄວາມພ້ອມ animation
                  _buildAnimatedLabel(
                    label: item.label,
                    isActive: isActive,
                    isSelected: isSelected,
                  ),
                  
                  /// ເສັ້ນຊີ້ວັດຕຳແໜ່ງ (active indicator ດ້ວຍຕົວເອງ)
                  if (isActive)
                    Container(
                      margin: const EdgeInsets.only(top: 4),
                      height: 3,
                      width: 20,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [_gradientStart, _gradientEnd],
                        ),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    )
                  else
                    const SizedBox(height: 7),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  /// ໄອຄອນພ້ອມ animation
  Widget _buildAnimatedIcon({
    required IconData icon,
    required bool isActive,
    required int index,
  }) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 400),
      curve: Curves.elasticOut,
      /**
       * ⚠️ `Matrix4.translate(dynamic x, …)` ຮັບໄດ້ແຕ່ **double / Vector3 / Vector4**
       * — ນອກນັ້ນມັນ `throw UnimplementedError()` (vector_math matrix4.dart).
       * ຂຽນ `translate(0, …)` ⇒ `0` ເປັນ **int** (ບໍ່ມີ double context ເພາະ x ເປັນ dynamic)
       * ⇒ ແອັບແດງທັງໜ້າຕອນ build. ຕ້ອງຂຽນ `0.0` ສະເໝີ.
       */
      transform: Matrix4.identity()
        ..scale(isActive ? 1.15 : 1.0)
        ..translate(0.0, isActive ? -2.0 : 0.0),
      child: Icon(
        icon,
        size: isActive ? 26 : 22,
        color: isActive 
            ? _primaryBlue 
            : Colors.grey.shade400,
      ),
    );
  }

  /// ຂໍ້ຄວາມພ້ອມ animation
  Widget _buildAnimatedLabel({
    required String label,
    required bool isActive,
    required bool isSelected,
  }) {
    return AnimatedDefaultTextStyle(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutCubic,
      style: TextStyle(
        fontSize: isActive ? 11 : 10,
        fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
        color: isActive 
            ? _primaryBlue 
            : Colors.grey.shade500,
        letterSpacing: isActive ? 0.2 : 0,
        height: 1.2,
      ),
      child: Text(
        label,
        overflow: TextOverflow.fade,
        softWrap: false,
      ),
    );
  }
}