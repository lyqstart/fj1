/**
 * AppNavigator — 应用根导航骨架
 *
 * 设计依据：WI-0001 §2.4 安卓端模块划分 / intake 业务流程
 *
 * 底部 Tab 结构（V1 最小集，对应检查员核心工作流）：
 *  1. 今日检查 (Today)        — 检查员当日任务列表与日报入口
 *  2. 问题篮子 (IssueBasket)  — 离线草拟的问题自查清单（待提交到日报）
 *  3. 我的 (Profile)          — 用户信息、同步状态、登出
 *
 * WI-0016 已激活 TodayInspectionScreen：Today Tab 现挂载嵌套 InspectionStack，
 * 提供 5 个路由（TodayInspection / TaskDetail / InspectionInProgress /
 * SubmitReport / IssueEvidence）。其中 TodayInspection 为真实 screen（218 行骨架），
 * 其余 4 个为 SimplePlaceholder 占位，由 WI-0017 / WI-0018 完成真实实装。
 * IssueBasket / Profile Tab 仍为 SimplePlaceholder，由 WI-0019 / WI-0020 实装。
 */
import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';

import TodayInspectionScreen from '../screens/today/TodayInspectionScreen';
import type { InspectionStackParamList } from '../screens/today/TodayInspectionScreen';
import TaskDetailScreen from '../screens/inspection/TaskDetailScreen';
import InspectionInProgressScreen from '../screens/inspection/InspectionInProgressScreen';
import IssueEvidenceScreen from '../screens/inspection/IssueEvidenceScreen';
import IssueBasketScreen from '../screens/issue-basket/IssueBasketScreen';
import SubmitReportScreen from '../screens/submit/SubmitReportScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

// ============== Root Tab 类型定义 ==============
/**
 * 底部 Tab 路由参数表。
 * undefined 表示该路由无参数。
 * 新增 Tab 时在此扩展类型，createBottomTabNavigator 泛型会强制 name 字段匹配。
 */
export type RootTabParamList = {
  Today: undefined;
  IssueBasket: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const InspectionStack = createStackNavigator<InspectionStackParamList>();

// ============== 通用占位组件 ==============
interface SimplePlaceholderProps {
  title: string;
  subtitle?: string;
}

/**
 * 通用占位组件：
 *  - Stack 内未实装 screen（TaskDetail / InspectionInProgress / SubmitReport / IssueEvidence）
 *  - IssueBasket / Profile Tab（WI-0019 / WI-0020 替换）
 *
 * 注意：通过 Stack.Screen 的 children 渲染回调包裹此组件，避免与
 * StackScreenProps 泛型签名直接耦合。
 */
function SimplePlaceholder({
  title,
  subtitle,
}: SimplePlaceholderProps): React.ReactElement {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

// ============== 嵌套 Stack：今日检查流程 ==============
/**
 * 嵌套在 Today Tab 内的 InspectionStack。
 *
 * 5 个路由名严格对齐 TodayInspectionScreen.tsx 的 InspectionStackParamList：
 *  - TodayInspection：真实实装（TodayInspectionScreen 218 行骨架）
 *  - TaskDetail / InspectionInProgress / SubmitReport / IssueEvidence：
 *    SimplePlaceholder 占位，由 WI-0017 / WI-0018 实装真实 screen
 *
 * TodayInspection 路由 headerShown:false —— Today Tab 已提供 header，
 * 避免 BottomTab header + Stack header 双 header。
 */
function InspectionStackScreen(): React.ReactElement {
  return (
    <InspectionStack.Navigator screenOptions={{ headerShown: true }}>
      <InspectionStack.Screen
        name="TodayInspection"
        component={TodayInspectionScreen}
        options={{ headerTitle: '今日检查', headerShown: false }}
      />
      <InspectionStack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{ headerTitle: '任务详情' }}
      />
      <InspectionStack.Screen
        name="InspectionInProgress"
        component={InspectionInProgressScreen}
        options={{ headerTitle: '检查中' }}
      />
      <InspectionStack.Screen
        name="SubmitReport"
        component={SubmitReportScreen}
        options={{ headerTitle: '提交日报' }}
      />
      <InspectionStack.Screen
        name="IssueEvidence"
        component={IssueEvidenceScreen}
        options={{ headerTitle: '问题证据' }}
      />
    </InspectionStack.Navigator>
  );
}

// ============== Tab 宿主组件 ==============
/**
 * IssueBasketScreen 骨架声明 navigation 为 StackNavigationProp<InspectionStackParamList>
 * （其"提交"/"编辑"动作需要 navigate 到 SubmitReport / IssueEvidence，这两个路由位于
 * Today Tab 内的 InspectionStack）。作为 BottomTab 子组件挂载时实际收到
 * BottomTabNavigationProp。运行时 React Navigation 支持跨嵌套导航器路由（navigate
 * ('SubmitReport') 会穿透到 Today Tab 内的 InspectionStack），此处 host 仅做类型桥接。
 */
type IssueBasketNavigation =
  Parameters<typeof IssueBasketScreen>[0]['navigation'];

function IssueBasketTabHost({
  navigation,
}: {
  navigation: BottomTabNavigationProp<RootTabParamList, 'IssueBasket'>;
}): React.ReactElement {
  return (
    <IssueBasketScreen
      navigation={navigation as unknown as IssueBasketNavigation}
    />
  );
}

// ============== 导航器 ==============
/**
 * 应用根导航组件。
 *
 * 使用方式：在 App.tsx 中
 *   const db = await initDatabase();
 *   return <AppNavigator />;
 *
 * 注：NavigationContainer 必须是组件树的根（或被 SafeAreaProvider 包裹后），
 *     所有屏幕都通过此容器导航。
 */
export default function AppNavigator(): React.ReactElement {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: '#1677ff',
          tabBarInactiveTintColor: '#999999',
        }}
      >
        <Tab.Screen
          name="Today"
          component={InspectionStackScreen}
          options={{ title: '今日检查', tabBarLabel: '今日检查' }}
        />
        <Tab.Screen
          name="IssueBasket"
          component={IssueBasketTabHost}
          options={{ title: '问题篮子', tabBarLabel: '问题篮子' }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: '我的', tabBarLabel: '我的' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// ============== 样式 ==============
const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
});
