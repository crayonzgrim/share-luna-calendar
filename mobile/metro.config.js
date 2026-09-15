const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const projectRoot = __dirname
const repoRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

// 웹과 공유하는 순수 로직(../src/lib)도 번들에 포함시킨다.
// 루트 node_modules는 일부러 빼둔다 — 감시 대상 밖이면 Metro가 거기서 패키지를
// 집어오지 않으므로, 웹용 react(19.2.8)가 앱 번들에 섞여 들어올 길이 막힌다.
config.watchFolders = [path.resolve(repoRoot, 'src/lib')]

// 위 결정의 대가: 공유 폴더의 파일이 import하는 패키지(korean-lunar-calendar 등)를
// 위로 훑어봐야 감시 대상 밖이라 못 찾는다. 앱 자신의 node_modules로 되돌린다.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')]

// 공유 코드(api.ts)가 supabase 클라이언트를 플랫폼별로 받아가는 통로.
// 웹은 vite.config.ts에서 같은 이름을 자기 클라이언트로 연결한다.
config.resolver.alias = {
  '@db': path.resolve(projectRoot, 'lib/supabase.ts'),
}

module.exports = config
