interface Milestone {
  year: string;
  body: string;
}

/**
 * 随手记：按年份排的时间线。
 * 只写真实发生过的：哪一年、在什么设备上、学了什么。不写格言。
 */
const timeline: Milestone[] = [
  {
    year: '2018',
    body:
      '音乐老师在课上说了句「你看到的每个软件都是代码写出来的」。回家我把 Windows 目录里的 DLL 挨个用记事本打开，满屏乱码。' +
      '后来才知道，那些文件本来就不是用记事本读的。',
  },
  {
    year: '2020',
    body: '开始拆 Minecraft 的资源包和 add-on。之后是 Lua、Python，再往后是 C。写脚本、编译程序，那几年大部分时间都耗在这上面。',
  },
  {
    year: '2023',
    body:
      '中间有几年没电脑用。重新开始时只有一台手机和 AIDE，就用它写 Java 和 Android，也是在那时碰到 GeometryOS（当时叫 HnciseOS）。' +
      'AIDE、Lua、Android 的底子还在，LuaJava 和 AndroLua 学得很快，给虚拟机写了不少工具和脚本。',
  },
  {
    year: '2024',
    body: '有了自己的电脑，第一次用 Kotlin，也第一次把电脑上的工具链完整跑通。',
  },
  {
    year: '2025–2026',
    body:
      '开始 Vibe Coding，并接触和自学了 Nuxt Vue React NestJS Koa2 PHP .NET 8 以及熟练的使用 git ',
  },
];

export function NotesPane() {
  return (
    <div className="pane pane--notes">
      <ol className="notes">
        {timeline.map((item) => (
          <li key={item.year}>
            <span className="notes__year">{item.year}</span>
            <p>{item.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
