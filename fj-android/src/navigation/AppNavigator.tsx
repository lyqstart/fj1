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
 * 此文件为骨架，每个 Tab 渲染占位组件；具体屏幕实现在后续 task 中开发
 * （对应 src/screens/today, src/screens/issue-basket, src/screens/profile）。
 */
import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

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

// ============== 占位屏幕 ==============
interface PlaceholderProps {
  title: string;
  subtitle?: string;
}

/**
 * Tab 占位组件。后续 task 会用真实屏幕替换。
 */
function PlaceholderScreen({ title, subtitle }: PlaceholderProps): React.ReactElement {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function TodayScreen(): React.ReactElement {
  return (
    <PlaceholderScreen
      title="今日检查"
      subtitle="骨架占位 — 待 TASK-020+ 实现：当日任务列表、日报入口"
    />
  );
}

function IssueBasketScreen(): React.ReactElement {
  return (
    <PlaceholderScreen
      title="问题篮子"
      subtitle="骨架占位 — 离线草拟的问题清单，待提交到日报"
    />
  );
}

function ProfileScreen(): React.ReactElement {
  return (
    <PlaceholderScreen
      title="我的"
      subtitle="骨架占位 — 用户信息、同步状态、登出"
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
          component={TodayScreen}
          options={{ title: '今日检查', tabBarLabel: '今日检查' }}
        />
        <Tab.Screen
          name="IssueBasket"
          component={IssueBasketScreen}
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
