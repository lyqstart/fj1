/**
 * Babel 配置
 *
 * 关键点：
 * 1. WatermelonDB Model 使用了 legacy decorators（@field / @text / @date 等），
 *    必须先加载 @babel/plugin-proposal-decorators（legacy: true），再加载
 *    @babel/plugin-proposal-class-properties（loose: true）。两者顺序不可颠倒，
 *    否则 Babel 会抛出 "decorator must precede class property" 错误。
 * 2. @react-native/babel-preset 内部也包含 class-properties，Babel 会按
 *    后加载优先的方式去重，最终 loose 生效，与 legacy decorators 兼容。
 */
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['@babel/plugin-proposal-class-properties', { loose: true }],
  ],
};
