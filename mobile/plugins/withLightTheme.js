// 안드로이드 네이티브 창(날짜 선택, Alert 등)을 기기 다크 모드와 상관없이 라이트로 고정한다.
// app.json의 userInterfaceStyle: "light"와 Appearance.setColorScheme('light')로는
// 이 창들이 계속 어둡게 떴다(갤럭시 S23·RN 0.86에서 확인).
// android/는 prebuild 때마다 새로 만들어지므로 styles.xml을 직접 고치지 않고 여기서 바꾼다.
// ponytail: 다크 토글을 만들면 DayNight로 되돌리고 런타임에 night mode를 넘길 것.
const { withAndroidStyles } = require('expo/config-plugins')

module.exports = (config) =>
  withAndroidStyles(config, (cfg) => {
    const app = cfg.modResults.resources.style?.find((s) => s.$.name === 'AppTheme')
    if (app) {
      app.$.parent = 'Theme.AppCompat.Light.NoActionBar'
      // 날짜 창의 머리·선택 원·버튼 색. 없으면 안드로이드 기본 청록이 나온다 (theme.ts accentStrong)
      app.item = app.item.filter((i) => i.$.name !== 'colorAccent')
      app.item.push({ $: { name: 'colorAccent' }, _: '#4f46e5' })
    }
    return cfg
  })
