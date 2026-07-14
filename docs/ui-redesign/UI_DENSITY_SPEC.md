# Density Spec

Attribute: `data-density="comfortable|productive|compact"` on documentElement.

| Mode | Control height | Table row | Default |
|------|----------------|-----------|---------|
| comfortable | 44px | 48px | touch / managers |
| productive | 36–40px | 36px | **default desktop** |
| compact | 32–36px | 32px | audit desktop only |

API: `applyDensity()` from `@/design-system`.

Narrow screens force min hit target 44px via media query.
