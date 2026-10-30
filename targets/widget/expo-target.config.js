/** iOS home-screen widget, built as a WidgetKit extension by @bacons/apple-targets. */
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'StepsWidget',
  icon: '../../assets/images/icon.png',
  deploymentTarget: '17.0',
  colors: {
    $accent: '#34D399',
    $widgetBackground: '#15181C',
  },
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
