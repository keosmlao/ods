class LinkTarget {
  final String workflow;
  final String code;
  const LinkTarget(this.workflow, this.code);
}

LinkTarget? linkTargetFrom(Map<String, dynamic> data) {
  var workflow = '${data['workflow'] ?? ''}';
  if (!const {'repair', 'install', 'maintenance'}.contains(workflow)) {
    workflow = switch ('${data['model'] ?? ''}') {
      'tb_product' => 'repair',
      'ods_tb_install' => 'install',
      'ods_tb_maintenance' => 'maintenance',
      _ => '',
    };
  }
  final code = '${data['code'] ?? data['resId'] ?? data['res_id'] ?? ''}'.trim();
  return workflow.isEmpty || code.isEmpty ? null : LinkTarget(workflow, code);
}
