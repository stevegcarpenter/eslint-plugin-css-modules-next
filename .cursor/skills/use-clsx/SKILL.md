---
name: use-clsx
description: Use clsx to combine / include multiple class names
---

# Overview

When combining class names to pass into a className prop on a component, be
certain to always use the clsx function from clsx package. When you need to
conditionally include a class, please use the object syntax for clsx:

eg
```
clsx(styles.mandatoryClass, { [styles.conditionalClass]: includeConditional })
```
