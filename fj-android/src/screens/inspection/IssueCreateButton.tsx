/**
 * IssueCreateButton — 创建问题按钮组件
 *
 * 设计依据：WI-0001 §2.4 / REQ-8 / TASK-022
 *
 * 职责：
 *  - 在检查中页面提供"创建问题"入口
 *  - 点击后导航到 IssueEvidenceScreen（由 TASK-028 实现）
 *  - 传递当前检查任务上下文（taskId + 可选 taskItemId）
 *
 * 骨架阶段：IssueEvidenceScreen 尚未注册到导航器（TASK-028），
 *           点击按钮触发 navigate 调用（路由未注册时运行时会被忽略），保持调用契约一致。
 */
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';

import type { InspectionStackParamList } from '../today/TodayInspectionScreen';

type Navigation = StackNavigationProp<InspectionStackParamList, 'IssueEvidence'>;

export interface IssueCreateButtonProps {
  /** 当前检查任务 ID */
  taskId: string;
  /** 关联的检查表条目 ID（可选，用于问题精确定位到条目） */
  taskItemId?: string;
}

export default function IssueCreateButton({
  taskId,
  taskItemId,
}: IssueCreateButtonProps): React.ReactElement {
  const navigation = useNavigation<Navigation>();

  const handlePress = () => {
    navigation.navigate('IssueEvidence', { taskId, taskItemId });
  };

  return (
    <TouchableOpacity
      testID="issue-create-btn"
      onPress={handlePress}
      style={styles.button}
      activeOpacity={0.7}
    >
      <Text style={styles.text}>+ 创建问题</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    height: 44,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1677ff',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#1677ff',
    fontSize: 15,
    fontWeight: '600',
  },
});
