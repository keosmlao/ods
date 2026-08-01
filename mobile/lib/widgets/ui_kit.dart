import 'dart:async';

import 'package:flutter/material.dart';

import '../main.dart';

/// ── ຊຸດ UI ກາງ (ອອກແບບໃໝ່) ──
/// ຊິ້ນສ່ວນທີ່ໃຊ້ຊ້ຳທຸກໜ້າ ⇒ ໜ້າຕາເປັນລະບົບດຽວກັນ ແລະ ແກ້ບ່ອນດຽວ.

/// ເງົານຸ້ມມາດຕະຖານຂອງກາດ (Minimalist micro shadow)
const kSoftShadow = [
  BoxShadow(color: Color(0x060F172A), blurRadius: 16, offset: Offset(0, 4)),
];

BoxDecoration cardDecoration({Color? color, Color? border, double borderRadius = 18}) => BoxDecoration(
  color: color ?? Colors.white,
  borderRadius: BorderRadius.circular(borderRadius),
  border: Border.all(color: border ?? const Color(0xFFF1F5F9)),
  boxShadow: kSoftShadow,
);

/// ຫົວແອັບບາ: eyebrow ນ້ອຍ + ຫົວຂໍ້ໃຫຍ່ (ໃຊ້ໃນ AppBar.title)
class AppTitle extends StatelessWidget {
  const AppTitle({super.key, required this.title, this.eyebrow = 'ODS by ODG'});
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
      borderRadius: BorderRadius.circular(13),
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: surfaceAlt,
          borderRadius: BorderRadius.circular(13),
          border: Border.all(color: line),
        ),
        child: Icon(icon, size: 20, color: muted),
      ),
    );
    final wrapped = badge == null || badge == 0
        ? btn
        : Stack(
            clipBehavior: Clip.none,
            children: [
              btn,
              Positioned(
                top: -3,
                right: -3,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  constraints: const BoxConstraints(minWidth: 16),
                  height: 16,
                  decoration: BoxDecoration(
                    color: danger,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.white, width: 1.5),
                  ),
                  child: Center(
                    child: Text(
                      '$badge',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9.5,
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
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? ink : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? ink : line),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: selected ? Colors.white : muted,
              ),
            ),
            if (count != null) ...[
              const SizedBox(width: 5),
              Text(
                '$count',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                  color: selected ? Colors.white70 : faint,
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
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
    decoration: BoxDecoration(
      color: bg,
      borderRadius: BorderRadius.circular(999),
    ),
    child: Text(
      text,
      style: TextStyle(
        fontSize: 10,
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
      SlaTone.late_ => (danger, const Color(0xFFFCE4EA)),
      SlaTone.soon => (warn, const Color(0xFFFBEED5)),
      SlaTone.ok => (ok, const Color(0xFFE1F5EC)),
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
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: fg, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
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

/// ປຸ່ມໄອຄອນແກ້ວ (glass) ເທິງ hero
class HeroIconButton extends StatelessWidget {
  const HeroIconButton({super.key, required this.icon, required this.onTap, this.badge});
  final IconData icon;
  final VoidCallback onTap;
  final int? badge;

  @override
  Widget build(BuildContext context) {
    final btn = InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: .14),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white.withValues(alpha: .18)),
        ),
        child: Icon(icon, size: 20, color: onHero),
      ),
    );
    if (badge == null || badge == 0) return btn;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        btn,
        Positioned(
          top: -3,
          right: -3,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            constraints: const BoxConstraints(minWidth: 16),
            height: 16,
            decoration: BoxDecoration(
              color: danger,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: hero1, width: 2),
            ),
            child: Center(
              child: Text(
                '$badge',
                style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// ຫົວຈໍ hero — ໄລ່ສີ emerald→ink, eyebrow + title + (ທາງເລືອກ) ແຖບ stat.
/// ໃຊ້ແທນ AppBar ໃນໜ້າຫຼັກ (jobs / manager / income / stock-count...).
class HeroHeader extends StatelessWidget {
  const HeroHeader({
    super.key,
    required this.title,
    this.eyebrow = 'ODS by ODG',
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
      gradient: LinearGradient(
        begin: Alignment.topRight,
        end: Alignment.bottomLeft,
        colors: [hero2, hero1],
      ),
      borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
      boxShadow: [
        BoxShadow(color: Color(0x1804241D), blurRadius: 20, offset: Offset(0, 10)),
      ],
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
        color: Colors.white.withValues(alpha: .06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: .10)),
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

  static const _sky = Color(0xFF0EA5E9);
  static const _violet = Color(0xFF8B5CF6);

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 13),
    padding: const EdgeInsets.all(1.5),
    decoration: BoxDecoration(
      gradient: const LinearGradient(colors: [teal, _sky, _violet]),
      borderRadius: BorderRadius.circular(18),
      boxShadow: kSoftShadow,
    ),
    child: Container(
      padding: const EdgeInsets.fromLTRB(13, 12, 13, 13),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [teal, _violet],
                  ),
                  borderRadius: BorderRadius.circular(7),
                ),
                child: const Icon(Icons.auto_awesome, size: 12, color: Colors.white),
              ),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w800,
                  color: _violet,
                  letterSpacing: .2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          DefaultTextStyle.merge(
            style: const TextStyle(fontSize: 12.5, color: ink, height: 1.5),
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
        fontSize: 12.5,
        fontWeight: FontWeight.w800,
        color: ink,
      ),
    ),
  );
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
