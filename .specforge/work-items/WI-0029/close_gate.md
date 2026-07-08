# Close Gate Evidence

- Work Item: WI-0029
- Status: passed
- Runner: gate_runner
- Timestamp: 2026-07-06T10:30:01.141Z

## Filesystem Diff Summary

- Created: 17
- Modified: 1562
- Deleted: 76
- Untracked: 1655
- Ignored Runtime Files: 0
- Evidence File: .specforge/work-items/WI-0029/filesystem_diff_evidence.json

## Checks

| Check ID | Description | Passed |
|----------|-------------|--------|
| close_file_work_item_json | Required file exists: work_item.json | ✓ |
| close_file_intake_md | Required file exists: intake.md | ✓ |
| close_file_change_classification_md | Required file exists: change_classification.md | ✓ |
| close_file_impact_analysis_md | Required file exists: impact_analysis.md | ✓ |
| close_file_trigger_result_json | Required file exists: trigger_result.json | ✓ |
| close_file_tasks_md | Required file exists: tasks.md | ✓ |
| close_file_trace_delta_md | Required file exists: trace_delta.md | ✓ |
| close_file_candidate_manifest_json | Required file exists: candidate_manifest.json | ✓ |
| close_file_gate_summary_md | Required file exists: gate_summary.md | ✓ |
| close_file_verification_report_md | Required file exists: verification_report.md | ✓ |
| close_file_merge_report_md | Required file exists: merge_report.md | ✓ |
| close_file_changed_files_audit_md | Required file exists: changed_files_audit.md | ✓ |
| close_file_evidence_evidence_manifest_json | Required file exists: evidence/evidence_manifest.json | ✓ |
| close_verification_nonempty | verification_report is not empty | ✓ |
| close_verification_refs_evidence | verification_report references Evidence (§13.3) | ✓ |
| close_user_decision_valid | User Decision is approved or waived (§10) | ✓ |
| close_user_decision_semantic_valid | User Decision is semantically valid: actor, workflow_path, Gate hash, manifest hash, candidate hash | ✓ |
| close_workflow_path_valid | workflow_path is valid (§6.4) | ✓ |
| close_code_permission_revoked | code_permission is revoked by daemon fact source (§12) | ✓ |
| close_allowed_write_empty | allowed_write_files is empty (§15.2.13-14) | ✓ |
| close_no_write_guard_violations | No unresolved Write Guard violations (§15.2.12) | ✓ |
| close_resume_plan_no_pending | No resume_plan present (not applicable) | ✓ |
| close_trace_delta_valid | trace_delta.md is not empty (§13.1) | ✓ |
| close_evidence_manifest_has_entries | evidence_manifest has entries (§13.4) | ✓ |
| close_merge_report_valid | merge_report has valid status (§11) | ✓ |
| close_changed_files_audit_passed | changed_files_audit passed (§15.2) | ✓ |
| close_post_merge_gate | post_merge_gate not present (assumed not_applicable) | ✓ |
| close_no_blocking_issues | No unresolved blocking issues (§15.2) | ✓ |
| close_waiver_follow_up | No waivers requiring follow-up | ✓ |
| close_extension_request_resolved | No extension_request.json present (not applicable) | ✓ |