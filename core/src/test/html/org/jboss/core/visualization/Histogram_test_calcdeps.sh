#!/bin/sh

../../../../../../../../closure-library-99cd91/closure/bin/calcdeps.py \
--dep ./../../../../../../../../closure-library-99cd91 \
--path ./../../../../../../main/javascript/org/jboss/core/visualization \
--output_mode deps \
> Histogram_test_deps.js

echo "Generated file: Histogram_test_deps.js"