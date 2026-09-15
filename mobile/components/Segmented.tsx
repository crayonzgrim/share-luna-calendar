import { Pressable, StyleSheet, Text, View } from 'react-native'
import { lift, radius, useColors } from '../lib/theme'

type Option<T extends string> = { value: T; label: string }

/**
 * 웹의 .segment(양력/음력)와 <select>(반복)를 하나로 합쳤다.
 * RN에는 select가 없고, 선택지가 두셋뿐이라 드롭다운보다 세그먼트가 손가락에 맞는다.
 */
export default function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T
  options: Option<T>[]
  onChange: (v: T) => void
  disabled?: boolean
}) {
  const c = useColors()
  return (
    <View
      style={{
        flexDirection: 'row',
        padding: 3,
        borderRadius: radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: c.shellLine,
        backgroundColor: c.shell,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {options.map((opt) => {
        const on = opt.value === value
        return (
          <Pressable
            key={opt.value}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled }}
            onPress={() => onChange(opt.value)}
            style={[
              {
                paddingVertical: 6,
                paddingHorizontal: 13,
                borderRadius: radius.pill,
                backgroundColor: on ? c.surface : 'transparent',
              },
              on ? lift(c) : null,
            ]}
          >
            <Text style={{ fontSize: 13, fontWeight: '500', color: on ? c.accentStrong : c.muted }}>
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
