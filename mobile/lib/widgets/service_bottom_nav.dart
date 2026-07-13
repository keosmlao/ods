import 'package:flutter/material.dart';

import '../main.dart';

class ServiceBottomNav extends StatelessWidget {
  const ServiceBottomNav({
    super.key,
    required this.selectedIndex,
    required this.onSelected,
  });

  final int selectedIndex;
  final ValueChanged<int> onSelected;

  static const items = [
    (Icons.work_outline_rounded, Icons.work_rounded, 'ວຽກ'),
    (Icons.inventory_2_outlined, Icons.inventory_2_rounded, 'ອາໄຫຼ່'),
    (Icons.payments_outlined, Icons.payments_rounded, 'ລາຍຮັບ'),
  ];

  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    minimum: const EdgeInsets.fromLTRB(16, 6, 16, 10),
    child: Container(
      height: 62,
      padding: const EdgeInsets.all(7),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFDCE5E2)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x220F172A),
            blurRadius: 24,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: List.generate(items.length, (index) {
          final item = items[index];
          final active = index == selectedIndex;
          return Expanded(
            child: Semantics(
              selected: active,
              button: true,
              label: item.$3,
              child: InkWell(
                onTap: active ? null : () => onSelected(index),
                borderRadius: BorderRadius.circular(18),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOut,
                  height: 48,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    color: active
                        ? const Color(0xFF087F6B)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        active ? item.$2 : item.$1,
                        size: 22,
                        color: active ? Colors.white : muted,
                      ),
                      if (active) ...[
                        const SizedBox(width: 7),
                        Flexible(
                          child: Text(
                            item.$3,
                            overflow: TextOverflow.fade,
                            softWrap: false,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    ),
  );
}
