import 'dart:async';

import 'package:flutter/material.dart';

import '../main.dart';

/// ── ຊຸດ UI ກາງ (ອອກແບບ v4 — Flat High-Contrast) ──
/// ຊິ້ນສ່ວນທີ່ໃຊ້ຊ້ຳທຸກໜ້າ ⇒ ໜ້າຕາເປັນລະບົບດຽວກັນ ແລະ ແກ້ບ່ອນດຽວ.
/// ຫຼັກການ v4: flat + border ແທນເງົາ (GPU ເກົ່າ render ໄວກວ່າ), ສຳຜັດ ≥48px,
/// contrast ສູງອ່ານງ່າຍເທິງຈໍລຸ້ນເກົ່າ.

/// ເງົາມາດຕະຖານ — v4 ໃຊ້ສະເພາະຊັ້ນທີ່ລອຍແທ້ (dialog/sheet) ເທົ່ານັ້ນ, ບໍ່ໃສ່ກາດປົກກະຕິ
const kSoftShadow = [
  BoxShadow(color: Color(0x140F172A), blurRadius: 8, offset: Offset(0, 2)),
];

/// ກາດ v4: ພື້ນຂາວ + ຂອບ 1px (ບໍ່ມີເງົາປົກກະຕິ — ປະຢັດ GPU ເຄື່ອງເກົ່າ)
BoxDecoration cardDecoration({Color? color, Color? border, double borderRadius = kCardRadius}) => BoxDecoration(
  color: color ?? surface,
  borderRadius: BorderRadius.circular(borderRadius),
  border: Border.all(color: border ?? line),
);

/// ຫົວແອັບບາ: eyebrow ນ້ອຍ + ຫົວຂໍ້ໃຫຍ່ (ໃຊ້ໃນ AppBar.title)
class AppTitle extends StatelessWidget {
  const AppTitle({super.key, required this.title, this.eyebrow = 'ODIEN Service'});
  final String title;
  final String eyebrow;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    mainAxisSize: MainAxisSize.min,
    children: [
      Text(
        eyebrow,
        style: const TextStyle(
          fontSize: 10.5,
          letterSpacing: 1.8,
          color: teal,
          fontWeight: FontWeight.w800,
        ),
      ),
      const SizedBox(height: 1),
      Text(
        title,
        style: const TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w800,
          color: ink,
          letterSpacing: -.3,
        ),
      ),
    ],
  );
}

/// ປຸ່ມໄອຄອນມົນ (bell / refresh) ໃນ AppBar
class RoundIconButton extends StatelessWidget {
  const RoundIconButton({
    super.key,
    required this.icon,
    required this.onTap,
    this.badge,
    this.tooltip,
  });
  final IconData icon;
  final VoidCallback onTap;
  final int? badge;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final btn = InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(kButtonRadius),
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: surfaceAlt,
          borderRadius: BorderRadius.circular(kButtonRadius),
          border: Border.all(color: lineStrong),
        ),
        child: Icon(icon, size: 21, color: ink),
      ),
    );
    final wrapped = badge == null || badge == 0
        ? btn
        : Stack(
            clipBehavior: Clip.none,
            children: [
              btn,
              Positioned(
                top: -4,
                right: -4,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5),
                  constraints: const BoxConstraints(minWidth: 18),
                  height: 18,
                  decoration: BoxDecoration(
                    color: danger,
                    borderRadius: BorderRadius.circular(9),
                    border: Border.all(color: surface, width: 1.5),
                  ),
                  child: Center(
                    child: Text(
                      '$badge',
                      style: const TextStyle(
                        color: onAccent,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: tooltip == null ? wrapped : Tooltip(message: tooltip!, child: wrapped),
    );
  }
}

/// ກາດ stat ນ້ອຍ (ຕົວເລກ + ປ້າຍ + icon)
class StatTile extends StatelessWidget {
  const StatTile({
    super.key,
    required this.label,
    required this.value,
    this.color = ink,
    this.icon,
  });
  final String label;
  final String value;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.all(13),
      decoration: cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 18, color: color),
            const SizedBox(height: 8),
          ],
          Text(
            value,
            style: TextStyle(
              fontSize: 24,
              height: 1,
              fontWeight: FontWeight.w800,
              color: color,
              letterSpacing: -.5,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(fontSize: 10.5, color: muted)),
        ],
      ),
    ),
  );
}

/// ຊິບກອງ (filter) — ເລືອກແລ້ວເປັນ ink
class FilterPill extends StatelessWidget {
  const FilterPill({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.count,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int? count;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(right: 7),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        // ສຳຜັດສູງ 44px — ກົດງ່າຍເທິງຈໍລຸ້ນເກົ່າ
        constraints: const BoxConstraints(minHeight: 44),
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? ink : surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? ink : lineStrong),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: selected ? onAccent : body,
              ),
            ),
            if (count != null) ...[
              const SizedBox(width: 5),
              Text(
                '$count',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: selected ? onAccent : faint,
                ),
              ),
            ],
          ],
        ),
      ),
    ),
  );
}

/// ປ້າຍຂັ້ນຕອນ (tint teal)
class StageTag extends StatelessWidget {
  const StageTag(this.text, {super.key, this.color = teal, this.bg = tealTint});
  final String text;
  final Color color;
  final Color bg;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: bg,
      borderRadius: BorderRadius.circular(999),
    ),
    child: Text(
      text,
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        color: color,
      ),
    ),
  );
}

enum SlaTone { late_, soon, ok }

/// ຊິບ SLA — ສີ semantic (ເລີຍ=ແດງ, ໃກ້=ສົ້ມ, ໃນເວລາ=ຂຽວ)
class SlaChip extends StatelessWidget {
  const SlaChip({super.key, required this.label, required this.tone});
  final String label;
  final SlaTone tone;

  @override
  Widget build(BuildContext context) {
    final (fg, bg) = switch (tone) {
      SlaTone.late_ => (danger, dangerTint),
      SlaTone.soon => (warn, warnTint),
      SlaTone.ok => (ok, okTint),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: fg, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: fg,
            ),
          ),
        ],
      ),
    );
  }
}

/// Scaffold ສຳເລັດຮູບ + hero header — ໃຫ້ໜ້າ detail ໃສ່ hero ໄດ້ດ້ວຍ edit ດຽວ.
/// ໃຊ້: return HeroScaffold(title: '...', onBack: () => Navigator.pop(context), body: <ເນື້ອໃນເກົ່າ>)
class HeroScaffold extends StatelessWidget {
  const HeroScaffold({
    super.key,
    required this.title,
    required this.body,
    this.onBack,
    this.trailing,
  });
  final String title;
  final Widget body;
  final VoidCallback? onBack;
  final List<Widget>? trailing;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: ground,
    body: Column(
      children: [
        HeroHeader(title: title, onBack: onBack, trailing: trailing),
        Expanded(child: body),
      ],
    ),
  );
}

/// 1 ຕົວເລກໃນແຖບ stat ຂອງ hero ( glass design )
class HeroStat {
  const HeroStat({
    required this.value,
    required this.label,
    this.color,
    this.icon,
    this.badgeColor,
  });
  final String value;
  final String label;
  final Color? color;
  final IconData? icon;
  final Color? badgeColor;
}

/// ປຸ່ມໄອຄອນເທິງ hero (v4: solid tile, ບໍ່ມີ alpha compositing)
class HeroIconButton extends StatelessWidget {
  const HeroIconButton({super.key, required this.icon, required this.onTap, this.badge});
  final IconData icon;
  final VoidCallback onTap;
  final int? badge;

  @override
  Widget build(BuildContext context) {
    final btn = InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(kButtonRadius),
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: hero2,
          borderRadius: BorderRadius.circular(kButtonRadius),
          border: Border.all(color: const Color(0xFF334155)),
        ),
        child: Icon(icon, size: 21, color: onHero),
      ),
    );
    if (badge == null || badge == 0) return btn;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        btn,
        Positioned(
          top: -4,
          right: -4,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 5),
            constraints: const BoxConstraints(minWidth: 18),
            height: 18,
            decoration: BoxDecoration(
              color: danger,
              borderRadius: BorderRadius.circular(9),
              border: Border.all(color: hero1, width: 2),
            ),
            child: Center(
              child: Text(
                '$badge',
                style: const TextStyle(color: onAccent, fontSize: 10, fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// ຫົວຈໍ hero v4 — ພື້ນ ink ລ້ວນ (ບໍ່ມີ gradient/ເງົາ — GPU ເກົ່າແຮງ), eyebrow + title +
/// (ທາງເລືອກ) ແຖບ stat. ໃຊ້ແທນ AppBar ໃນໜ້າຫຼັກ (jobs / manager / income / stock-count...).
class HeroHeader extends StatelessWidget {
  const HeroHeader({
    super.key,
    required this.title,
    this.eyebrow = 'ODIEN Service',
    this.trailing,
    this.above,
    this.stats,
    this.onBack,
    this.inlineBack = false,
  });
  final String title;
  final String eyebrow;
  final List<Widget>? trailing; // ປຸ່ມມุมขวา (bell/refresh/menu)
  final Widget? above; // ແຖວเหนือ title (ເຊັ່ນ ปุ่ม back)
  final List<HeroStat>? stats;
  final VoidCallback? onBack; // ໜ້າ detail — ປຸ່ມກັບຄືນເທິງ hero
  final bool inlineBack; // ໜ້າ detail ແບບກະທັດຮັດ: ປຸ່ມກັບຊ້າຍ · ຫົວຂໍ້ຂວາ (ແຖວດຽວ)

  @override
  Widget build(BuildContext context) => Container(
    decoration: const BoxDecoration(
      color: hero1,
      borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
    ),
    child: SafeArea(
      bottom: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(18, 10, 18, inlineBack ? 14 : 20),
        child: inlineBack
            ? Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  if (onBack != null)
                    InkWell(
                      onTap: onBack,
                      borderRadius: BorderRadius.circular(8),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.arrow_back_rounded, size: 22, color: onHero),
                          SizedBox(width: 5),
                          Text('ກັບຄືນ', style: TextStyle(color: onHeroDim, fontSize: 13, fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  const Spacer(),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(eyebrow, style: const TextStyle(fontSize: 10, letterSpacing: 1.8, color: onHeroDim, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 3),
                      Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: onHero, letterSpacing: -.3)),
                    ],
                  ),
                ],
              )
            : Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (onBack != null) ...[
                        InkWell(
                          onTap: onBack,
                          borderRadius: BorderRadius.circular(8),
                          child: const Padding(
                            padding: EdgeInsets.symmetric(vertical: 2),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.arrow_back_rounded, size: 20, color: onHero),
                                SizedBox(width: 5),
                                Text(
                                  'ກັບຄືນ',
                                  style: TextStyle(
                                    color: onHeroDim,
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                      ],
                      if (above != null) ...[above!, const SizedBox(height: 6)],
                      Text(
                        eyebrow,
                        style: const TextStyle(
                          fontSize: 10,
                          letterSpacing: 1.8,
                          color: onHeroDim,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        title,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          color: onHero,
                          letterSpacing: -.3,
                        ),
                      ),
                    ],
                  ),
                ),
                if (trailing != null) ...[
                  for (final w in trailing!) ...[w, const SizedBox(width: 8)],
                ],
              ],
            ),
            if (stats != null && stats!.isNotEmpty) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  for (var i = 0; i < stats!.length; i++) ...[
                    if (i > 0) const SizedBox(width: 9),
                    Expanded(child: _HeroStatTile(stats![i])),
                  ],
                ],
              ),
            ],
          ],
        ),
      ),
    ),
  );
}

class _HeroStatTile extends StatelessWidget {
  const _HeroStatTile(this.stat);
  final HeroStat stat;

  @override
  Widget build(BuildContext context) {
    final valueColor = stat.color ?? onHero;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: hero2,
        borderRadius: BorderRadius.circular(kCardRadius),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                stat.value,
                style: TextStyle(
                  fontSize: 24,
                  height: 1,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -.5,
                  color: valueColor,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              if (stat.icon != null)
                Icon(stat.icon, size: 15, color: valueColor.withValues(alpha: .7)),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            stat.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: onHeroDim),
          ),
        ],
      ),
    );
  }
}

/// ── Flow ຊ່າງ: ແຖບຄວາມຄືບໜ້າ 6 ຂັ້ນ ──
/// ໃຫ້ຊ່າງຮູ້ວ່າຢູ່ຂັ້ນໃດ (ຮັບ→ກວດ→ອາໄຫຼ່→ຮັບເຄື່ອງ→ສ້ອມ→QC).
class StepProgress extends StatelessWidget {
  const StepProgress({
    super.key,
    required this.current,
    required this.label,
    this.total = 6,
  });
  final int current; // 1-based
  final int total;
  final String label;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
            decoration: BoxDecoration(
              color: tealTint,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              'ຂັ້ນ $current / $total',
              style: const TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w800,
                color: teal,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: ink,
            ),
          ),
        ],
      ),
      const SizedBox(height: 9),
      Row(
        children: [
          for (var i = 0; i < total; i++) ...[
            if (i > 0) const SizedBox(width: 5),
            Expanded(
              child: Container(
                height: 5,
                decoration: BoxDecoration(
                  color: (i + 1) < current
                      ? tealBright
                      : (i + 1) == current
                      ? teal
                      : line,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
          ],
        ],
      ),
    ],
  );
}

/// ── ຜູ້ຊ່ວຍ AI (ຍຸກ 2026) — ກາดขอบไล่สี + sparkle ──
/// title (ຫົວ), body (ຂໍ້ຄວາມ), chips (ຄຳแนะนำแตะได้ · ทางเลือก).
class AiAssistCard extends StatelessWidget {
  const AiAssistCard({
    super.key,
    this.title = 'ຜູ້ຊ່ວຍ AI',
    required this.body,
    this.chips,
  });
  final String title;
  final Widget body;
  final List<Widget>? chips;

  static const _violet = Color(0xFF7C3AED); // violet 600 — contrast ສູງກວ່າ

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 13),
    decoration: BoxDecoration(
      // v4 flat — ບໍ່ມີ gradient border (ປະຢັດ GPU ເຄື່ອງເກົ່າ)
      color: const Color(0xFFF5F3FF), // violet 50
      borderRadius: BorderRadius.circular(kCardRadius),
      border: Border.all(color: const Color(0xFFDDD6FE)), // violet 200
    ),
    child: Padding(
      padding: const EdgeInsets.fromLTRB(14, 13, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: _violet,
                  borderRadius: BorderRadius.circular(7),
                ),
                child: const Icon(Icons.auto_awesome, size: 13, color: onAccent),
              ),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                  color: _violet,
                  letterSpacing: .2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 9),
          DefaultTextStyle.merge(
            style: const TextStyle(fontSize: 13, color: ink, height: 1.5),
            child: body,
          ),
          if (chips != null && chips!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(spacing: 6, runSpacing: 6, children: chips!),
          ],
        ],
      ),
    ),
  );
}

/// ຊິບຄຳແນະນຳຈາກ AI (ແຕະເລືອກ)
class AiChip extends StatelessWidget {
  const AiChip({super.key, required this.label, this.confidence, this.selected = false, this.onTap});
  final String label;
  final int? confidence; // %
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(999),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
      decoration: BoxDecoration(
        color: selected ? tealTint : surfaceAlt,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: selected ? teal : line),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: selected ? teal : muted,
            ),
          ),
          if (confidence != null) ...[
            const SizedBox(width: 5),
            Text(
              '$confidence%',
              style: const TextStyle(fontSize: 10, color: faint),
            ),
          ],
        ],
      ),
    ),
  );
}

/// ຫົວຂໍ້ໝວດຍ່ອຍ (ໃນກາດ)
class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10, left: 2),
    child: Text(
      text,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w800,
        color: ink,
      ),
    ),
  );
}

/// ── ສະຖານະໜ້າຈໍມາດຕະຖານ (loading / empty / error) — ຟອນໃຫຍ່ອ່ານງ່າຍ ──
class StateBlock extends StatelessWidget {
  const StateBlock({
    super.key,
    required this.icon,
    required this.message,
    this.detail,
    this.action,
  });
  final IconData icon;
  final String message;
  final String? detail;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: surfaceAlt,
              shape: BoxShape.circle,
              border: Border.all(color: line),
            ),
            child: Icon(icon, size: 26, color: muted),
          ),
          const SizedBox(height: 14),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: ink,
            ),
          ),
          if (detail != null) ...[
            const SizedBox(height: 6),
            Text(
              detail!,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: muted, height: 1.45),
            ),
          ],
          if (action != null) ...[const SizedBox(height: 16), action!],
        ],
      ),
    ),
  );
}

/// ແຖບປຸ່ມລຸ່ມຕິດໜ້າຈໍ (sticky action bar) — ຄຳສັ່ງຫຼັກຂອງໜ້າ ຢູ່ນິ້ວໂປ້ສະເໝີ.
/// ຮອງຮັບ safe-area ລຸ່ມ (ເຄື່ອງມີແຖບ gesture).
class StickyActionBar extends StatelessWidget {
  const StickyActionBar({super.key, required this.child, this.padding});
  final Widget child;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) => Container(
    decoration: const BoxDecoration(
      color: surface,
      border: Border(top: BorderSide(color: line)),
    ),
    child: SafeArea(
      top: false,
      child: Padding(
        padding: padding ?? const EdgeInsets.fromLTRB(16, 12, 16, 12),
        child: child,
      ),
    ),
  );
}

/// ແຖວລາຍການມາດຕະຖານ (icon ຕົ້ນ · ຫົວ+ຮອງ · ທ້າຍ) — ໃຊ້ໃນ list ທຸກໜ້າ.
class ListRow extends StatelessWidget {
  const ListRow({
    super.key,
    required this.title,
    this.subtitle,
    this.icon,
    this.iconColor,
    this.trailing,
    this.onTap,
  });
  final String title;
  final String? subtitle;
  final IconData? icon;
  final Color? iconColor;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final row = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          if (icon != null) ...[
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: surfaceAlt,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 20, color: iconColor ?? muted),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: ink,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12.5, color: muted, height: 1.35),
                  ),
                ],
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 10), trailing!],
        ],
      ),
    );
    if (onTap == null) return row;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: row,
      ),
    );
  }
}

/// ຮູບແບບເວລາ ຄືກັບເວັບ: `N ມື້ HH:MM:SS` (ບໍ່ມີວັນ = `HH:MM:SS`)
String formatElapsed(int totalSeconds) {
  final s = totalSeconds < 0 ? 0 : totalSeconds;
  final days = s ~/ 86400;
  final rest = s % 86400;
  final clock = [rest ~/ 3600, (rest % 3600) ~/ 60, rest % 60]
      .map((p) => p.toString().padLeft(2, '0'))
      .join(':');
  return days > 0 ? '$days ມື້ $clock' : clock;
}

/// ເວລາທີ່ **ເດີນທຸກວິນາທີ** — ຮັບຈຳນວນວິນາທີຈາກ server ແລ້ວນັບຕໍ່ຢູ່ເຄື່ອງ
/// (ຄືກັບ `<Elapsed>` ຂອງເວັບ). `live=false` = ຄ່າຄົງທີ່ (ຂັ້ນທີ່ຜ່ານແລ້ວ — ບໍ່ເດີນ).
class LiveElapsed extends StatefulWidget {
  const LiveElapsed({super.key, required this.seconds, this.live = true, this.style});
  final int? seconds;
  final bool live;
  final TextStyle? style;

  @override
  State<LiveElapsed> createState() => _LiveElapsedState();
}

class _LiveElapsedState extends State<LiveElapsed> {
  late int _value;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _value = widget.seconds ?? 0;
    _restart();
  }

  @override
  void didUpdateWidget(LiveElapsed old) {
    super.didUpdateWidget(old);
    if (old.seconds != widget.seconds || old.live != widget.live) {
      _value = widget.seconds ?? 0;
      _restart();
    }
  }

  void _restart() {
    _timer?.cancel();
    if (widget.live && widget.seconds != null) {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() => _value += 1);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.seconds == null) return Text('-', style: widget.style);
    return Text(
      formatElapsed(_value),
      style: (widget.style ?? const TextStyle()).copyWith(
        fontFeatures: const [FontFeature.tabularFigures()],
      ),
    );
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   v5 — ຊິ້ນສ່ວນ "ວຽກມາກ່ອນຂໍ້ມູນ"

   ສາມອັນລຸ່ມນີ້ຄືກະດູກສັນຫຼັງຂອງ v5:
     · NextActionBar — ປຸ່ມທີ່ຕ້ອງກົດ **ອັນດຽວ** ຄ້າງຢູ່ລຸ່ມຈໍສະເໝີ
     · StepCard      — ຂັ້ນທີ່ຜ່ານແລ້ວພັບໄວ້ ເຫຼືອແຕ່ຂັ້ນປັດຈຸບັນເປີດ
     · TimeChip      — ເວລາ/ຄວາມຮີບ ອ່ານໄດ້ດ້ວຍສີ ບໍ່ຕ້ອງອ່ານຕົວໜັງສື
   ══════════════════════════════════════════════════════════════════════════ */

/// ຄວາມຮີບຂອງເວລາ — ສີຕາຍຕົວຕາມ token v5 (ແດງຊ້າ · ເຫຼືອງໃກ້ · ຂຽວດີ · ເທົາເສີຍ)
enum TimeTone { late_, soon, done, plain }

/// ຊິບເວລາຂອງກາດວຽກ — ຕົວເລກໃຊ້ tabular ⇒ ຫຼາຍກາດຮຽງກັນແລ້ວເລກຢູ່ແນວດຽວກັນ
class TimeChip extends StatelessWidget {
  const TimeChip(this.label, {super.key, this.tone = TimeTone.plain, this.icon});
  final String label;
  final TimeTone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final (fg, bg) = switch (tone) {
      TimeTone.late_ => (danger, dangerTint),
      TimeTone.soon => (warn, warnTint),
      TimeTone.done => (ok, okTint),
      TimeTone.plain => (muted, surfaceAlt),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 12, color: fg), const SizedBox(width: 4)],
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: fg,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

/// ຫົວກຸ່ມໃນລາຍການ ("ຊ້າແລ້ວ · 2") — ບອກ**ຈຳນວນ**ນຳ ຈຶ່ງຮູ້ປະລິມານກ່ອນເລື່ອນ
class BandHeader extends StatelessWidget {
  const BandHeader(this.label, {super.key, this.count, this.color = ink});
  final String label;
  final int? count;
  final Color color;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(2, 4, 2, 2),
    child: Row(
      children: [
        Text(
          label,
          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w900, color: color),
        ),
        if (count != null) ...[
          const SizedBox(width: 7),
          Text(
            '$count',
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
              color: faint,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
        ],
        const SizedBox(width: 10),
        const Expanded(child: Divider(height: 1)),
      ],
    ),
  );
}

/// ແຖບຄວາມຄືບໜ້າແບບຂີດ — ບອກວ່າ "ຢູ່ຂັ້ນໃດ ໃນຈັກຂັ້ນ" ໂດຍບໍ່ກິນຄວາມສູງ
class StepRail extends StatelessWidget {
  const StepRail({super.key, required this.total, required this.current, required this.label});

  /// ຈຳນວນຂັ້ນທັງໝົດ · ຂັ້ນປັດຈຸບັນ (ເລີ່ມທີ 1)
  final int total;
  final int current;
  final String label;

  @override
  Widget build(BuildContext context) => Container(
    color: surface,
    padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
    child: Row(
      children: [
        for (var i = 1; i <= total; i++) ...[
          Expanded(
            // ຂັ້ນປັດຈຸບັນກວ້າງກວ່າ ⇒ ຫາຕຳແໜ່ງຕົນເອງໄດ້ດ້ວຍຫາງຕາ
            flex: i == current ? 16 : 10,
            child: Container(
              height: 5,
              decoration: BoxDecoration(
                color: i <= current ? teal : surfaceAlt,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          if (i < total) const SizedBox(width: 4),
        ],
        const SizedBox(width: 9),
        Text(
          '$current/$total · $label',
          style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: teal),
        ),
      ],
    ),
  );
}

/// ສະຖານະຂອງຂັ້ນ — ຜ່ານແລ້ວ · ກຳລັງເຮັດ · ຍັງບໍ່ຮອດ
/// (ຊື່ `JobStepState` ບໍ່ແມ່ນ `StepState` ເພາະ Material ມີ `StepState` ຂອງ Stepper ຢູ່ແລ້ວ)
enum JobStepState { done, current, locked }

/// ກາດ 1 ຂັ້ນຂອງງານ.
///
/// ⚠️ ຫົວໃຈຂອງ v5: **ຂັ້ນທີ່ຜ່ານແລ້ວພັບໄວ້** ເຫຼືອແຖວດຽວ (✓ + ເວລາ + ຫຼັກຖານ),
/// ຂັ້ນປັດຈຸບັນເປີດ, ຂັ້ນໜ້າຈາງລົງພ້ອມບອກວ່າລໍຫຍັງ ⇒ ໜ້າງານທີ່ເຄີຍຍາວ 8 ຈໍ
/// ເຫຼືອປະມານ 1.5 ຈໍ ແລະ ຊ່າງບໍ່ຕ້ອງເລື່ອນຫາວ່າ "ດຽວນີ້ຕ້ອງເຮັດຫຍັງ".
///
/// ຂັ້ນທີ່ຜ່ານແລ້ວຍັງ**ເປີດເບິ່ງໄດ້** (ກົດຫົວ) — ຫຼັກຖານເກົ່າຕ້ອງເຂົ້າເຖິງໄດ້ ບໍ່ແມ່ນຖືກລຶບ.
class StepCard extends StatefulWidget {
  const StepCard({
    super.key,
    required this.step,
    required this.title,
    this.state = JobStepState.locked,
    this.meta,
    this.child,
  });

  /// ເລກຂັ້ນ (ສະແດງໃນກ່ອງນ້ອຍ; ຜ່ານແລ້ວຈະເປັນ ✓)
  final int step;
  final String title;
  final JobStepState state;

  /// ຂໍ້ຄວາມຂວາຂອງຫົວ — ເວລາທີ່ເຮັດ · ຈຳນວນຮູບ · ເຫດຜົນທີ່ຍັງລໍ
  final String? meta;

  /// ເນື້ອໃນຂອງຂັ້ນ (null = ບໍ່ມີຫຍັງໃຫ້ເປີດ ⇒ ຫົວບໍ່ກົດໄດ້)
  final Widget? child;

  @override
  State<StepCard> createState() => _StepCardState();
}

class _StepCardState extends State<StepCard> {
  late bool _open = widget.state == JobStepState.current;

  @override
  void didUpdateWidget(StepCard old) {
    super.didUpdateWidget(old);
    // ຂັ້ນຂະຫຍັບ (server ຕອບຄຳສັ່ງແລ້ວ) ⇒ ເປີດຂັ້ນໃໝ່ໃຫ້ເອງ
    if (widget.state != old.state && widget.state == JobStepState.current) {
      _open = true;
    }
  }

  @override
  Widget build(BuildContext context) {
    final locked = widget.state == JobStepState.locked;
    final current = widget.state == JobStepState.current;
    final (markBg, markFg) = switch (widget.state) {
      JobStepState.done => (okTint, ok),
      JobStepState.current => (teal, onAccent),
      JobStepState.locked => (surfaceAlt, faint),
    };
    final canOpen = widget.child != null && !locked;
    final open = _open && canOpen;

    return Opacity(
      opacity: locked ? .55 : 1,
      child: Container(
        decoration: BoxDecoration(
          color: surface,
          borderRadius: BorderRadius.circular(kCardRadius),
          border: Border.all(color: current ? teal : line, width: current ? 1.5 : 1),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: canOpen ? () => setState(() => _open = !_open) : null,
                borderRadius: BorderRadius.circular(kCardRadius),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 11, 12, 11),
                  child: Row(
                    children: [
                      Container(
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          color: markBg,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: widget.state == JobStepState.done
                            ? Icon(Icons.check_rounded, size: 15, color: markFg)
                            : Center(
                                child: Text(
                                  '${widget.step}',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w900,
                                    color: markFg,
                                  ),
                                ),
                              ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          widget.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: ink,
                          ),
                        ),
                      ),
                      if (widget.meta != null) ...[
                        const SizedBox(width: 8),
                        Text(
                          widget.meta!,
                          style: const TextStyle(fontSize: 11.5, color: faint, fontWeight: FontWeight.w600),
                        ),
                      ],
                      if (canOpen) ...[
                        const SizedBox(width: 4),
                        Icon(
                          open ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                          size: 20,
                          color: faint,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
            if (open)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                child: widget.child,
              ),
          ],
        ),
      ),
    );
  }
}

/// ປຸ່ມຮອງໃນແຖບ "ຂັ້ນຕໍ່ໄປ" (ໂທ · ນຳທາງ · ແຊັດ)
class NextActionIcon {
  const NextActionIcon({required this.icon, required this.onTap, this.tooltip, this.badge});
  final IconData icon;
  final VoidCallback? onTap;
  final String? tooltip;
  final int? badge;
}

/// **ແຖບ "ຂັ້ນຕໍ່ໄປ"** — ຄ້າງລຸ່ມຈໍ, ມີປຸ່ມຫຼັກ **ອັນດຽວ**.
///
/// ເປັນຫຍັງ: ປຸ່ມທີ່ຖືກຕ້ອງເຄີຍຝັງຢູ່ກາງໜ້າຍາວໆ ⇒ ຊ່າງເລື່ອນຫາ ແລະ ບາງເທື່ອກົດອັນຜິດ.
/// ດຽວນີ້ຄຳຕອບຂອງ server (`job.action`) ຢູ່ບ່ອນດຽວ ໃນໄລຍະນິ້ວໂປ້ ບໍ່ວ່າຈະເລື່ອນໄປໃສ.
///
/// [blocker] = ເຫດຜົນທີ່ຍັງກົດບໍ່ໄດ້ (ເຊັ່ນ "ຕ້ອງແນບຮູບຜົນງານກ່ອນ") — ສະແດງ
/// **ຕິດເທິງປຸ່ມ** ບໍ່ແມ່ນຢູ່ໄກໃນໜ້າ ຈຶ່ງເຫັນພ້ອມກັບຕອນທີ່ພົບວ່າກົດບໍ່ໄດ້.
class NextActionBar extends StatelessWidget {
  const NextActionBar({
    super.key,
    required this.label,
    required this.onPressed,
    this.caption = 'ຂັ້ນຕໍ່ໄປ',
    this.icon,
    this.blocker,
    this.busy = false,
    this.tone = teal,
    this.actions = const [],
  });

  final String label;
  final VoidCallback? onPressed;
  final String caption;
  final IconData? icon;
  final String? blocker;
  final bool busy;
  final Color tone;
  final List<NextActionIcon> actions;

  @override
  Widget build(BuildContext context) {
    final blocked = blocker != null;
    return StickyActionBar(
      padding: const EdgeInsets.fromLTRB(12, 9, 12, 10),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (blocked)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: warnTint,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline_rounded, size: 15, color: warn),
                  const SizedBox(width: 7),
                  Expanded(
                    child: Text(
                      blocker!,
                      style: const TextStyle(fontSize: 12, color: warn, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.only(bottom: 7, left: 2),
              child: Row(
                children: [
                  Icon(Icons.arrow_upward_rounded, size: 13, color: tone),
                  const SizedBox(width: 5),
                  Text(
                    caption,
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w900,
                      color: tone,
                      letterSpacing: .4,
                    ),
                  ),
                ],
              ),
            ),
          Row(
            children: [
              for (final action in actions) ...[
                _NextIconButton(action: action),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: SizedBox(
                  height: kPrimaryTouch,
                  child: FilledButton.icon(
                    onPressed: busy || blocked ? null : onPressed,
                    style: FilledButton.styleFrom(
                      backgroundColor: tone,
                      disabledBackgroundColor: surfaceAlt,
                      disabledForegroundColor: faint,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(kButtonRadius),
                      ),
                    ),
                    icon: busy
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: onAccent),
                          )
                        : Icon(icon ?? Icons.arrow_forward_rounded, size: 20),
                    label: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _NextIconButton extends StatelessWidget {
  const _NextIconButton({required this.action});
  final NextActionIcon action;

  @override
  Widget build(BuildContext context) {
    final button = InkWell(
      onTap: action.onTap,
      borderRadius: BorderRadius.circular(kButtonRadius),
      child: Container(
        width: kPrimaryTouch,
        height: kPrimaryTouch,
        decoration: BoxDecoration(
          color: surface,
          borderRadius: BorderRadius.circular(kButtonRadius),
          border: Border.all(color: lineStrong),
        ),
        child: Icon(action.icon, size: 21, color: action.onTap == null ? faint : ink),
      ),
    );
    final badge = action.badge;
    final wrapped = badge == null || badge == 0
        ? button
        : Stack(
            clipBehavior: Clip.none,
            children: [
              button,
              Positioned(
                right: -2,
                top: -2,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  decoration: BoxDecoration(
                    color: danger,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: surface, width: 1.5),
                  ),
                  child: Text(
                    '$badge',
                    style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: onAccent),
                  ),
                ),
              ),
            ],
          );
    return action.tooltip == null ? wrapped : Tooltip(message: action.tooltip!, child: wrapped);
  }
}

/// ກາດ **ພັບໄດ້** ສຳລັບຂໍ້ມູນອ້າງອີງ (ຮູບເກົ່າ · ເສັ້ນເວລາ · ປະຫວັດ).
///
/// v5: ຂໍ້ມູນເຫຼົ່ານີ້ມີຄ່າຕອນຢາກຮູ້ ແຕ່ບໍ່ແມ່ນສິ່ງທີ່ຕ້ອງເຫັນທຸກເທື່ອທີ່ເປີດໜ້າ —
/// ປ່ອຍໃຫ້ກາງເປີດຢູ່ ມັນຍູ້ສ່ວນ "ຕ້ອງລົງມື" ຕົກລົງໄປລຸ່ມຈໍ. ພັບໄວ້ ⇒ ໜ້າສັ້ນລົງ
/// ໂດຍບໍ່ໄດ້ເອົາຂໍ້ມູນຫຍັງອອກ (ກົດເປີດໄດ້ຕະຫຼອດ).
class FoldCard extends StatefulWidget {
  const FoldCard({
    super.key,
    required this.title,
    required this.child,
    this.icon,
    this.iconColor = teal,
    this.meta,
    this.initiallyOpen = false,
  });

  final String title;
  final Widget child;
  final IconData? icon;
  final Color iconColor;

  /// ຂໍ້ຄວາມຂວາ — ຈຳນວນ/ສະຫຼຸບ ໃຫ້ຮູ້ວ່າຂ້າງໃນມີຫຍັງ ໂດຍບໍ່ຕ້ອງເປີດ
  final String? meta;
  final bool initiallyOpen;

  @override
  State<FoldCard> createState() => _FoldCardState();
}

class _FoldCardState extends State<FoldCard> {
  late bool _open = widget.initiallyOpen;

  @override
  Widget build(BuildContext context) => Container(
    decoration: cardDecoration(),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => setState(() => _open = !_open),
            borderRadius: BorderRadius.circular(kCardRadius),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 13, 12, 13),
              child: Row(
                children: [
                  if (widget.icon != null) ...[
                    Icon(widget.icon, size: 18, color: widget.iconColor),
                    const SizedBox(width: 9),
                  ],
                  Expanded(
                    child: Text(
                      widget.title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: ink,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  if (widget.meta != null) ...[
                    Text(
                      widget.meta!,
                      style: const TextStyle(fontSize: 12, color: faint, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(width: 6),
                  ],
                  Icon(
                    _open ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                    size: 21,
                    color: faint,
                  ),
                ],
              ),
            ),
          ),
        ),
        if (_open)
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            child: widget.child,
          ),
      ],
    ),
  );
}
