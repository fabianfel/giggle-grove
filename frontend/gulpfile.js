const gulp = require("gulp");
const inline = require("gulp-inline");
const htmlmin = require("gulp-htmlmin");

gulp.task("default", () => {
  return gulp
    .src("./dist/*/*/*.html")
    .pipe(inline())
    .pipe(htmlmin({ collapseWhitespace: true }))
    .pipe(gulp.dest("./dist"));
});
