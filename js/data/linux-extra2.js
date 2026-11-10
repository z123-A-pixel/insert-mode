export default {
  id: 'linux',
  chapters: [
    {
      id: 'lx-08',
      title: '交叉编译与工具链：为什么不能在板子上编译',
      tags: ['交叉编译', '工具链', 'ARM'],
      level: 3,
      freq: 3,
      summary: '板子算力小又缺编译器，代码要在电脑上编好，再拷到板子上运行。',
      analogy: '像在大厨房把菜做好再送进小公寓：板子只有一口小灶，连案板都摆不下，更请不起厨师。',
      example: 'Ubuntu 上跑 arm-linux-gnueabihf-gcc hello.c -o hello，file 显示 ARM。scp 到 /root 执行；用本机 gcc 编，板子报 cannot execute binary file。',
      points: [
        '交叉编译器名字里写着目标架构和浮点 ABI',
        '电脑上的 glibc 不能比板子上的新',
        '头文件和库要用板子那一套 sysroot',
        '编完用 file 和 readelf 核对架构',
        '库版本对不上时，先试加 -static 静态链接'
      ],
      detail: [
        '板子上通常只有几十兆内存，跑不动编译器，也没有 /usr/include 和开发库。就算把 gcc 塞进去，编一个文件也要几分钟，还容易因为内存不足被杀掉。所以行规是电脑上编，板子上跑，两边只传最后的可执行文件。',
        '交叉编译器是一整套工具：gcc 负责编，ld 负责链接，还有 as、ar、strip。名字里的 gnueabihf 说明目标用 glibc 和硬浮点。装好后跑 arm-linux-gnueabihf-gcc -v 看一眼，确认目标架构是 arm，别拿错版本。',
        '最常见的坑是库版本：电脑上 glibc 2.35 编出来的程序，板子上只有 2.28，一跑就报 GLIBC_2.34 not found。要么换和板子同版本的交叉工具链，要么加 -static 静态链接，把库直接打进可执行文件。'
      ],
      visual: null,
      pitfalls: [
        '板子报 Exec format error：多半是用本机 gcc 编的 x86 程序。查法：在电脑上执行 file hello，看输出是 x86-64 还是 ARM。',
        '运行时报 GLIBC 版本找不到：工具链比板子新。查法：板子上跑 ldd --version 看 glibc 版本，再换匹配的工具链或改静态链接。'
      ],
      qa: [
        {
          q: '为什么不能在板子上直接装 gcc 编译？',
          a: '板子内存和存储都小，编译器加头文件动辄几百兆，编译时还容易内存不足。板子通常也没装开发库。电脑上编好再传，速度快几十倍，工具链也好统一管理。'
        }
      ]
    },
    {
      id: 'lx-09',
      title: '内核模块的编译与加载：Makefile 怎么写',
      tags: ['内核模块', 'ko', 'insmod'],
      level: 3,
      freq: 2,
      summary: '把驱动写成 ko 文件，电脑上编译，板子上用 insmod 插进去，不用重烧内核。',
      analogy: '内核像一栋已经入住的楼，模块像后期加装的空调：不用拆楼，打个孔装上就能用，拆下来也不影响主体。',
      example: '写 hello.c 和 Makefile，make -C /home/leo/linux-imx M=$PWD modules 出 hello.ko。scp 到板子 insmod 后 dmesg 看到 hello world。',
      points: [
        'obj-m += hello.o 告诉内核编哪个文件',
        '编译要在内核源码树里做，用 -C 指过去',
        'M=$PWD 表示模块源码在当前目录',
        'insmod 加载，rmmod 卸载，lsmod 查看',
        'printk 的输出用 dmesg 看，别用 printf'
      ],
      detail: [
        '模块不是普通程序，没有 main，也不能直接调 printf。入口函数用 module_init 注册，退出用 module_exit，打印走 printk。加载时内核调用入口，卸载时调用出口，中间靠文件操作结构体把 read、write 接到你的函数上。',
        'Makefile 只写两行就够：obj-m 指定目标文件，all 目标里用 make -C 内核路径 M=模块路径 modules。内核路径必须是板子那颗内核的源码树，版本号差一点都会加载失败，报 invalid module format。',
        '编出来的 ko 要跟板子内核版本严格一致。用 uname -r 看板子版本，电脑上源码树也切到同一版本。加载前先 insmod，再用 dmesg 看最后几行，报错一般写得很直白，缺符号、版本不符、权限不够都一眼能认出来。'
      ],
      visual: null,
      pitfalls: [
        'insmod 报 invalid module format：ko 与板子内核版本或配置不一致。查法：板子 uname -r，电脑上看源码树 Makefile 开头的版本号。',
        'insmod 报 Unknown symbol：模块用了内核没导出的函数。查法：dmesg 看缺哪个符号，在源码里 grep 一下有没有 EXPORT_SYMBOL。'
      ],
      qa: [
        {
          q: 'Makefile 里的 -C 和 M 各是什么意思？',
          a: '-C 先把目录切到内核源码树，借用那边的编译规则；M 再指回模块自己的源码目录。两句合起来就是：用内核的规则，编我这里的文件。'
        }
      ]
    },
    {
      id: 'lx-10',
      title: '根文件系统与 BusyBox：第一次开机缺什么',
      tags: ['根文件系统', 'BusyBox', 'rootfs'],
      level: 3,
      freq: 3,
      summary: '内核起来后要找一个能用的根目录，里面要有 init、shell 和基本命令。',
      analogy: '内核像刚装修好的毛坯房，根文件系统是家具和锅碗。没有它，灯能亮，但你没地方坐，也没法做饭。',
      example: '板子启动报 Kernel panic: No init found。把 rootfs.tar 解到 /dev/mmcblk0p2，确认 /sbin/init、/dev/console、/etc/inittab 都在，再启动就进 shell。',
      points: [
        '内核挂载根文件系统后才去找 /sbin/init',
        'BusyBox 一个二进制提供几百条常用命令',
        'init 读 /etc/inittab 决定起几个 shell',
        '/dev/console 和 /dev/null 必须存在',
        '程序依赖的 so 要一起放进 /lib'
      ],
      detail: [
        '根文件系统就是挂载在 / 上的那棵树，里面至少有 /bin、/sbin、/etc、/dev、/lib、/proc。内核启动最后一步会执行 /sbin/init，找不到就 panic。很多人以为烧了内核就能跑，真正缺的是这棵树。',
        'BusyBox 把 ls、cp、mount、ifconfig 这些命令塞进一个可执行文件，靠软链接切换身份。省空间，也省交叉编译的麻烦。但只给常用选项，参数比桌面版少，脚本里用了冷门参数就会报错，要提前试。',
        '第一次开机常见的缺口有三个：没有 /dev/console，串口看不到任何输出；没有 /etc/inittab，起来了也不给你 shell；动态链接的程序缺 /lib 下的 so，一执行就报 not found。用 file 和 ldd 挨个确认，比猜快。'
      ],
      visual: null,
      pitfalls: [
        '启动卡在 No init found：根文件系统没挂上或没有 /sbin/init。查法：看 bootargs 里 root= 指向的分区，挂载后 ls /sbin/init。',
        '命令能跑但一执行就报 not found：缺动态库。查法：用 arm-linux-gnueabihf-readelf -d 看依赖，或直接改静态编译。'
      ],
      qa: [
        {
          q: '为什么有了内核还要单独做根文件系统？',
          a: '内核只负责管硬件和进程，命令、配置、启动脚本都在根文件系统里。两者分开做，换应用不用重编内核，升级内核也不用动应用，产线打包更灵活。'
        }
      ]
    },
    {
      id: 'lx-11',
      title: 'U-Boot 启动流程：上电到内核的那几秒',
      tags: ['U-Boot', 'bootargs', '启动'],
      level: 3,
      freq: 3,
      summary: '上电先跑芯片内固件，再跑 U-Boot，由它初始化内存、加载内核并把启动参数递过去。',
      analogy: '像接力赛：芯片内的 ROM 跑第一棒，SPL 跑第二棒，U-Boot 是第三棒，最后一棒把内核和设备树交到终点。',
      example: '串口 115200 上电看到 U-Boot，倒计时按空格停下，printenv 看 bootargs，setenv bootargs console=ttyS0,115200 root=/dev/mmcblk0p2 rw，再 boot。',
      points: [
        '片内 ROM 先从 SD 卡或 SPI 读第一段代码',
        'SPL 把 DDR 初始化好，再把 U-Boot 搬进内存',
        'U-Boot 读环境变量决定从哪加载内核',
        'bootargs 是递给内核的启动参数',
        'bootcmd 决定自动启动还是停在命令行'
      ],
      detail: [
        '上电那一刻 CPU 只能访问片内一小块 SRAM，装不下 U-Boot。所以先跑 rom code，它从启动介质读 SPL；SPL 很小，任务只有一个：把 DDR 配好，把完整的 U-Boot 搬到 DDR 里执行。',
        'U-Boot 起来后先打印版本和内存大小，再读环境变量。bootcmd 是一串命令，通常从 eMMC 或网络把内核 zImage 和设备树 dtb 读进内存，然后 bootm 跳过去。倒计时按空格可以打断，进命令行手动调。',
        'bootargs 写错是最常见的黑屏原因。console=ttyS0,115200 决定日志从哪个串口出，root= 决定根文件系统在哪。参数不对，内核可能一声不吭就挂了，所以改完先用 printenv 核对，再 saveenv 存下去。'
      ],
      visual: null,
      pitfalls: [
        '串口只打印到 DRAM 就停：DDR 参数或内存型号不匹配。查法：换回厂商提供的 SPL 和配置，核对 DDR 型号与时序。',
        '内核起来但找不到根文件系统：bootargs 的 root= 写错或分区号不对。查法：U-Boot 里 mmc part 看分区表，再对一遍 root= 的值。'
      ],
      qa: [
        {
          q: 'U-Boot 里的 bootargs 是给谁用的？',
          a: '给内核用。U-Boot 把这段字符串放在内存固定位置传给内核，内核解析后决定控制台、根文件系统、内存大小等。改错一个词，内核就可能起不来或找不到根目录。'
        }
      ]
    },
    {
      id: 'lx-12',
      title: '串口控制台与登录：板子没显示怎么救',
      tags: ['串口', 'console', 'ttyS0'],
      level: 2,
      freq: 3,
      summary: '板子没有屏幕时，串口就是唯一的眼睛和键盘，接对三根线就能看日志并登录。',
      analogy: '串口像板子的急诊通道：屏幕和网络都断了，只要这三根线通着，你还能进去看心跳、改药方。',
      example: 'USB 转 TTL 的 GND 先接板子 GND，TX 接 RX、RX 接 TX，执行 minicom -D /dev/ttyUSB0 -b 115200，上电看到 login:，输 root 进入 shell。',
      points: [
        '只接 GND、TX、RX 三根，VCC 别接',
        '常用参数是 115200 8N1，两边必须一致',
        'console=ttyS0,115200 要写进 bootargs',
        '登录后先 dmesg 看内核报了什么错',
        '忘密码可在 bootargs 加 init=/bin/sh'
      ],
      detail: [
        '调试串口一般是板子上的三针或四针排针，标着 GND、TXD、RXD。用 USB 转 TTL 模块连电脑，模块的 RX 接板子 TX，TX 接板子 RX，GND 对 GND。千万别把模块的 VCC 接到板子上，两边都有电会打架。',
        '电脑上用 minicom、picocom 或 putty 打开对应串口，波特率 115200，8 位数据，无校验，1 位停止。参数不对就是满屏乱码。上电后能看到 U-Boot 和内核日志，说明链路通了，这比任何指示灯都可靠。',
        '如果一点输出都没有，先短接模块的 TX 和 RX 做自环，能回显说明模块和驱动没问题；再交换 TX、RX 试一次；最后用示波器或万用表看板子 TX 脚上电瞬间有没有波形。都没有，就查板子供电和串口电平。'
      ],
      visual: null,
      pitfalls: [
        '串口满屏乱码：波特率或时钟不对。查法：先换 9600 试，再看板子晶振和 U-Boot 里的波特率配置。',
        '有日志但敲回车没反应：TX 线没接对或流控打开。查法：交换 TX/RX，串口工具里关掉硬件流控。'
      ],
      qa: [
        {
          q: '板子完全没显示，怎么判断是没启动还是串口没接好？',
          a: '先给串口模块做自环，能回显说明电脑这侧正常。再量板子 TX 脚上电瞬间有无波形，有波形说明板子在跑，问题在接线或波特率；没波形才怀疑供电和启动。'
        }
      ]
    },
    {
      id: 'lx-13',
      title: '开机自启：systemd 和 rc.local 怎么选',
      tags: ['systemd', 'rc.local', '自启'],
      level: 3,
      freq: 3,
      summary: '程序要开机就跑，新系统写 systemd 服务，老系统用 rc.local 脚本。',
      analogy: 'systemd 像机场塔台，按航班表排队、监控、误点还能重排；rc.local 像门口一块留言板，谁先谁后全看写的顺序。',
      example: '新建 /etc/systemd/system/app.service，ExecStart 写 /opt/app/run.sh，systemctl enable app 后重启。老系统改用 /etc/init.d/S99app 脚本。',
      points: [
        'systemd 能管依赖、自动重启和日志',
        'rc.local 简单，但没有依赖和失败重试',
        '服务里一律写绝对路径，别靠环境变量',
        '前台程序用 Type=simple，后台程序要留进程',
        '查日志用 journalctl -u 服务名 -e'
      ],
      detail: [
        'systemd 服务文件放 /etc/systemd/system，最少三段：Unit 描述、Service 的 ExecStart、Install 的 WantedBy=multi-user.target。改完 systemctl daemon-reload 再 enable。',
        'rc.local 是给老系统留的后门，脚本按行执行，前面的命令卡住后面就永远等不到。它没有重启机制，程序崩了就是崩了。做产品别把关键业务放这里，调试阶段临时用很方便。',
        '选型看两条：要不要在别的服务之后启动，崩了要不要自动拉起。要，就用 systemd；只是开机跑一条脚本、跑完就退出，rc.local 足够。不管用哪个，脚本里都写全路径，开机时的环境变量和你登录后不一样。'
      ],
      visual: null,
      pitfalls: [
        '服务写了但开机没起：忘了 enable 或路径不对。查法：systemctl status app 看状态，journalctl -u app -e 看报错。',
        '脚本手动能跑，开机报 command not found：环境变量不全。查法：脚本里用 /usr/bin/python3 这类绝对路径，或在服务里设 Environment=PATH=/usr/bin:/bin。'
      ],
      qa: [
        {
          q: '为什么 rc.local 里的程序开机经常起不来？',
          a: '开机时 PATH 很短，工作目录是 /，网络和磁盘可能还没就绪。脚本里用了相对路径或依赖环境变量就会失败。改成绝对路径，并在前面加 sleep 或判断设备就绪。'
        }
      ]
    },
    {
      id: 'lx-14',
      title: '用 Buildroot 或 Yocto 做一版镜像',
      tags: ['Buildroot', 'Yocto', '镜像'],
      level: 3,
      freq: 2,
      summary: '手工拼根文件系统太慢，用构建系统选好板子和软件包，一条 make 就能产出可烧镜像。',
      analogy: '像点套餐：Buildroot 是固定搭配的快餐，选好主菜几分钟出餐；Yocto 是自助厨房，什么都能改，但要先学会开火。',
      example: 'git clone buildroot 后 make imx6ull_defconfig，menuconfig 勾 openssh，make -j8，output/images 下出了 zImage 和 sdcard.img。',
      points: [
        'Buildroot 上手快，适合中小项目和量产',
        'Yocto 层次多，适合长期维护和大团队',
        'defconfig 决定芯片、板子和默认软件包',
        '首次编译要下载大量源码，很吃网络',
        '产物在 output/images，可直接 dd 到卡'
      ],
      detail: [
        'Buildroot 的思路是配置加编译：选芯片架构、选板子、勾软件包，make 一把梭，最后给你内核、根文件系统和打包好的镜像。目录结构简单，改一个包就 make 包名-rebuild，几分钟出结果。',
        'Yocto 用 layer 和 recipe 描述一切，能精确控制每个包的版本和编译选项，也能复用芯片厂商的 BSP 层。代价是概念多、首次编译几小时、磁盘要留上百 G，新手容易被报错劝退。',
        '选哪个看项目寿命。做个小设备，三五个人维护一两年，Buildroot 足够；要做多条产品线、长期升级、还得过安全审计，Yocto 的层次化才撑得住。两者都能出 sdcard.img，dd 到 TF 卡插上就能启动。'
      ],
      visual: null,
      pitfalls: [
        '编译到一半报下载失败：源码包地址失效或网络受限。查法：看 dl 目录缺哪个包，手动下载放进 dl 再 make。',
        '镜像烧进去起不来：内核和设备树不匹配。查法：串口看 U-Boot 输出的加载地址，核对 output/images 里的 dtb 名字。'
      ],
      qa: [
        {
          q: 'Buildroot 和 Yocto 最核心的区别是什么？',
          a: 'Buildroot 是一套 Makefile 加配置，目标是快速产出一个固定镜像；Yocto 是一套元数据构建框架，目标是可复用、可扩展地维护长期产品。前者快，后者稳。'
        }
      ]
    }
  ]
};