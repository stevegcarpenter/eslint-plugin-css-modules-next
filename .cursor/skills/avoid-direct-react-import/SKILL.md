---
name: avoid-direct-react-import
description: Avoid direct React import
---

# Overview

Inside tsx/jsx/ts/js files, if you need access to a hook/function/type/etc, always
prefer importing it using the { } syntax. eg import { useCallback } from 'react';
instead of import React from 'react'; and then using React.useCallback in the code.
