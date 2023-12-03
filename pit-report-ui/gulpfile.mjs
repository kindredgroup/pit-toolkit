import inline from 'gulp-inline'
import minifyCss from 'gulp-minify-css'
import autoprefixer from 'gulp-autoprefixer'

import gulp from 'gulp'

gulp.task("default", () => {
  return gulp.src('dist/pit-report-ui/browser/index.html')
    .pipe(inline({
      base: 'dist/pit-report-ui/browser/',
      js: [],
      css: [],
      disabledTypes: ['svg', 'img'], // Only inline css files
      ignore: []
    }))
    .pipe(gulp.dest('single-dist/'));
})