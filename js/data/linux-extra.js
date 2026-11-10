export default {
  id: 'linux',
  chapters: [
    {
      id: 'lx-01',
      title: '什么时候换 Linux：MCU 不够用的几个信号',
      tags: ['选型', 'Linux', 'MCU'],
      level: 3,
      freq: 2,
      summary: 'MCU 跑不动界面、网络、文件系统和大内存时，就是换 Linux 的信号。',
      analogy: 'MCU 像自行车，灵活省电，买菜代步够用；要拉货、上高速、载五个人，就得换小货车。不是自行车不好，是活变了。',
      example: '产品要 7 寸触摸屏加 WiFi 传图，STM32F4 的 192KB 内存连一帧 framebuffer 都放不下，换 i.MX6ULL 跑 Linux，Qt 界面和网络协议栈一起上。',
      points: [
        '要图形界面、网络协议栈、文件系统，MCU 很吃力',
        '内存按 MB 算、主频上 GHz，才带得动多任务',
        '外设复杂、要用现成驱动框架时，Linux 省时间',
        '只做开关量采集、电池供电，MCU 更合适'
      ],
      detail: [
        '先看内存：图形界面一帧 800x480 的 RGB565 就要 750KB，MCU 的 SRAM 直接见底。再看软件：文件系统、TCP/IP、USB、多进程，这些在 Linux 上都是现成的，在 MCU 上要一个个抠出来。',
        '反面也要算清：Linux 启动通常要几秒到几十秒，待机功耗按百毫瓦算，DDR 和 eMMC 让 BOM 涨一截。只做几路开关量采集、电池供电的小产品，MCU 更划算。',
        '判断顺序是先列需求再选平台：要不要图形界面、要不要联网、要不要存文件、团队会不会写驱动。四项里中两项以上，基本可以上 Linux 了；只中一项，先用 RTOS 顶住，别为了上而上。'
      ],
      visual: null,
      pitfalls: [
        '换了 Linux 板子开机 25 秒，产品要求 3 秒出图：内核和 uboot 没裁剪。查法：串口打时间戳，分段看卡在 uboot、内核还是 rootfs。',
        '内存只有 64MB 却要跑 Qt，程序一开就 OOM：没算 framebuffer 和库的体积。查法：free 看剩余内存，top 看哪个进程在涨。'
      ],
      qa: [
        {
          q: '项目要不要从 MCU 换到 Linux，先看哪几个指标？',
          a: '看四项：要不要图形界面、要不要联网和文件系统、内存需求是否超过几 MB、团队有没有 Linux 驱动经验。中两项以上就值得换，否则先用 RTOS 顶住。'
        }
      ]
    },
    {
      id: 'lx-02',
      title: '字符设备驱动：从 open 到 write 的完整链路',
      tags: ['字符设备', 'VFS', '设备号'],
      level: 3,
      freq: 2,
      summary: '应用调 open、write，内核按设备号找到驱动，再一路调到你写的函数。',
      analogy: '像去银行办事：先取号（设备号）找到窗口，窗口后坐着柜员（驱动函数），你说存钱（write），他按流程办完给你回执。',
      example: '应用 open /dev/myled 后 write 一个 1，VFS 按主设备号 240 找到 cdev，调用驱动的 my_write，灯亮。cat /proc/devices 能看到 240 myled。',
      points: [
        '主设备号找驱动，次设备号找具体设备',
        'open 拿 inode 里的设备号去查 cdev',
        'file_operations 是驱动交给内核的函数表',
        'insmod 只加载模块，设备节点要 mknod 或 udev 建'
      ],
      detail: [
        '整条链路是：应用调 open，陷入内核，VFS 拿路径找到 inode，从 inode 取出设备号，用主设备号在 cdev 数组里找到你的驱动，再把 file_operations 里的 open 换成你写的那个。',
        'write 走同一张表。应用把缓冲区指针和长度传进来，内核先做拷贝和检查，再调你的 write，你在里面操作寄存器。返回值是实际写成功的字节数，写 0 字节应用会以为失败。',
        '加载模块只是把代码放进内核，/dev 下的节点得另外建：mknod /dev/myled c 240 0。用 udev 或 mdev 的系统，驱动里创建 class 和 device，节点会自动出现。'
      ],
      visual: null,
      pitfalls: [
        'open 返回 No such file or directory：节点没建或名字不对。查法：cat /proc/devices 看主设备号，ls -l /dev/myled 看类型是不是 c。',
        'insmod 报 Invalid module format：内核版本和编译时用的头文件不一致。查法：uname -r 对比模块 vermagic，用对应源码树重新编。'
      ],
      qa: [
        {
          q: '应用 write 之后，怎么确认真的进到驱动里了？',
          a: '在驱动的 write 里加 printk，用 dmesg 看输出；同时看返回值，成功返回写入字节数，失败返回负的错误码。两条都对上，才说明链路通了。'
        }
      ]
    },
    {
      id: 'lx-03',
      title: 'file_operations：驱动要填哪几个函数',
      tags: ['file_operations', '接口', 'read'],
      level: 3,
      freq: 2,
      summary: 'file_operations 是驱动交给内核的函数表，用到哪个填哪个，没填的一调就报错。',
      analogy: '像开一家店挂出的服务牌：点单、结账、售后各写一块。牌子上没写的服务，客人问了只能回一句「不提供」。',
      example: 'LED 驱动只填 owner、open、write、release 四项，read 指针留空。应用 cat /dev/myled 时内核返回 -EINVAL，不会崩，但功能就是没有。',
      points: [
        'owner 一般填 THIS_MODULE，防止使用中被卸载',
        'open 和 release 管打开与关闭，做初始化和清理',
        'read 和 write 的 buf 是用户态地址，得拷贝',
        'unlocked_ioctl 处理自定义命令，别用老的 ioctl',
        '没填的成员是空指针，内核会返回 -EINVAL'
      ],
      detail: [
        '这张表是一个 const 结构体，成员全是函数指针，名字在内核头文件里定死。你只要按名字填，内核在对应时机替你调用，不用注册也不用回调注册表。填错类型编译就报错，比运行时猜安全得多。',
        '最容易踩的是地址空间。read 和 write 收到的 buf 是用户态虚拟地址，内核不能直接解引用，必须 copy_to_user 或 copy_from_user，否则页错误直接 oops。',
        'ioctl 用来传命令和参数，命令号用 _IOR、_IOW 这类宏生成，避免和别的驱动撞号。新代码更推荐改成读写 sysfs 属性，语义清楚，也好调试，比如亮度就写成 brightness 文件。'
      ],
      visual: null,
      pitfalls: [
        '应用 read 返回 -EINVAL：驱动没填 read 成员。查法：看 fops 结构体初始化，缺的项补上或让应用改用 ioctl。',
        'copy_to_user 后应用拿到全 0：传的是内核指针或长度算错。查法：打印 buf 地址和 count，确认来源是用户态，并检查返回值。'
      ],
      qa: [
        {
          q: 'open 和 release 里一般各做什么？',
          a: 'open 里做硬件上电、申请 GPIO、初始化寄存器，并检查设备是否被占用；release 里释放这些资源，把状态清干净。两者要成对，不然反复打开会漏资源。'
        }
      ]
    },
    {
      id: 'lx-04',
      title: '设备树：硬件描述为什么要单独放一个文件',
      tags: ['设备树', 'dts', 'compatible'],
      level: 3,
      freq: 2,
      summary: '硬件长什么样写进设备树，驱动只管按描述干活，换板子不用改一行代码。',
      analogy: '设备树像一块板子的接线表：哪个脚接 LED、I2C 挂在哪条总线，全写在表上。驱动是施工队，照着表干活，换板子只换表。',
      example: 'arch/arm/boot/dts/myboard.dts 的 led 节点加 gpios = <&gpio1 3 GPIO_ACTIVE_LOW>;，make dtbs 后启动，/proc/device-tree 下可见 led 目录。',
      points: [
        'dts 是源文件，dtb 是编译后给内核的二进制',
        'dtsi 放芯片和板子的公共部分，dts 只写差异',
        'compatible 字符串把设备和驱动对上',
        '驱动用 of_get_property 或专用 API 读属性',
        '硬件改动只改 dts，驱动可以复用'
      ],
      detail: [
        '以前板级信息硬编码在 arch/arm/mach-xxx 里，一颗芯片一个文件，改个引脚就要重编内核。设备树把这些描述抽成数据文件，内核只留通用解析代码，同一份内核能带多块板子。',
        '匹配靠 compatible。驱动里写 of_match_table，字符串和 dts 节点里的 compatible 完全一致，probe 才会被调用。对不上，驱动加载了也静默不工作。',
        '启动后内核把 dtb 展开到 /proc/device-tree，节点变成目录，属性变成文件。调不通时直接 cat 这些文件，比反复改代码快得多，比如 compatible 文件里就写着匹配串。'
      ],
      visual: null,
      pitfalls: [
        '改了 dts 但行为没变：dtb 没重编，或 uboot 加载的还是旧分区里的文件。查法：cat /proc/device-tree/节点/compatible，看是不是新值。',
        '驱动 probe 不执行：compatible 拼错或节点 status 是 disabled。查法：dmesg 里搜驱动的匹配日志，再核对 dts 原文。'
      ],
      qa: [
        {
          q: '设备树和驱动，各负责什么？',
          a: '设备树回答「板子上有什么、接在哪、参数多少」，是数据；驱动回答「这类设备怎么操作」，是代码。同一份驱动配不同 dts，就能跑在很多块板子上。'
        }
      ]
    },
    {
      id: 'lx-05',
      title: 'GPIO 子系统与 pinctrl：点个灯要改哪几处',
      tags: ['GPIO', 'pinctrl', 'gpiod'],
      level: 3,
      freq: 2,
      summary: '点灯三处：pinctrl 配复用，dts 写 gpios，驱动 gpiod_get 拉高。',
      analogy: 'pinctrl 像把多功能插排的某个孔切到「通电」档，gpio 像那个孔的开关。先切对档，再按开关，灯才亮。',
      example: 'dts 里 pinctrl 把 GPIO1_IO03 配成 GPIO，led 节点写 gpios = <&gpio1 3 GPIO_ACTIVE_LOW>，驱动 gpiod_get 后 gpiod_set_value(led, 1)。',
      points: [
        'pinctrl 管引脚复用和上下拉、驱动强度',
        'gpio 子系统管方向、电平和中断',
        'gpiod_get 拿描述符，别再用全局 gpio 号',
        'dts 里 gpios 属性的名字要和驱动里一致',
        '电平有效极性写在 dts，驱动不用管正负'
      ],
      detail: [
        '一个引脚往往有五六种功能：普通 GPIO、UART 的 TX、I2C 的 SCL。pinctrl 就是那个功能选择开关，选错了，GPIO 寄存器怎么写都没反应。',
        '分两层看：pinctrl 决定这个脚「是什么」，gpio 决定它「输出什么」。dts 里 pinctrl-0 引用一组配置，gpios 属性声明用途，驱动两层都不用自己写寄存器。',
        '老代码用 gpio_request 加编号，编号在不同芯片上不通用。新写法用 gpiod_get(dev, 「led」, GPIOD_OUT_LOW)，名字对应 dts 里 led-gpios 属性，换平台不用改代码。'
      ],
      visual: null,
      pitfalls: [
        'gpiod_get 返回 -ENOENT：dts 里没有对应属性或名字拼错。查法：看 /proc/device-tree 下节点有没有 led-gpios，再对一遍驱动里的名字。',
        '代码没报错但灯不亮：pinctrl 没配，引脚还复用成别的功能。查法：读 IOMUXC 复用寄存器，或量引脚电压看有没有变化。'
      ],
      qa: [
        {
          q: '为什么现在推荐 gpiod 而不是直接操作 GPIO 编号？',
          a: '编号是芯片相关的全局数字，换平台就得改，还容易和别的驱动抢同一个脚。gpiod 用设备加名字取描述符，资源归属清楚，dts 里改一行就能换脚。'
        }
      ]
    },
    {
      id: 'lx-06',
      title: 'I2C 和 SPI 子系统：驱动里怎么读寄存器',
      tags: ['I2C', 'SPI', '总线驱动'],
      level: 3,
      freq: 2,
      summary: 'I2C 和 SPI 的时序由子系统包了，驱动只要给出地址和寄存器，调一个函数就完成收发。',
      analogy: 'I2C 像一条走廊上挂满门牌，喊门牌号，答应的那个就是目标；SPI 像专用通道加一根片选线，拉低哪根线就跟谁说话。',
      example: '读传感器 ID 用 i2c_smbus_read_byte_data(client, 0x0F)，返回 0x40 说明芯片在线；SPI Flash 用 spi_write_then_read(spi, &cmd, 1, buf, 3)。',
      points: [
        'I2C 两根线，靠地址区分设备，容易冲突',
        'SPI 四根线，靠片选区分设备，速度快',
        '时序、时钟、重试都由子系统处理，别自己翻转引脚',
        'dts 里把设备挂在对应总线节点下',
        '先用 i2cdetect 确认设备在，再写驱动'
      ],
      detail: [
        'I2C 驱动拿到的是 i2c_client，里面已经有地址和适配器。要读寄存器，拼一个写寄存器地址加读数据的消息数组，调 i2c_transfer，失败会返回负值。',
        'SPI 没有统一的寄存器概念，读写得按芯片手册来：先发命令字，再读回数据。spi_write_then_read 一次完成两段，片选由子系统自动拉低拉高。CPOL 和 CPHA 在 dts 里配，别在驱动里硬写。',
        '调试顺序很重要：先用工具确认硬件在，再怀疑驱动。i2cdetect -y 1 能扫出地址，逻辑分析仪能看波形，两个都对，问题才在代码里。反过来先改驱动，往往白改半天。'
      ],
      visual: null,
      pitfalls: [
        'i2c_transfer 返回 -ENXIO：地址写错或设备没上电。查法：i2cdetect -y 1 扫地址，示波器看 SCL 上有没有时钟。',
        'SPI 读回全是 0xFF：片选没拉低，或 CPOL、CPHA 和手册不符。查法：逻辑分析仪抓四根线，对照时序图一个沿一个沿看。'
      ],
      qa: [
        {
          q: 'I2C 地址冲突会有什么现象，怎么解决？',
          a: '总线上两个设备同地址，读出来数据乱跳或直接超时。先用 i2cdetect 扫出全部地址，再改掉一台设备的地址脚，或加多路复用器把总线分开。'
        }
      ]
    },
    {
      id: 'lx-07',
      title: '中断和下半部：为什么不能在中断里干重活',
      tags: ['中断', '下半部', '工作队列'],
      level: 3,
      freq: 2,
      summary: '中断里只做最急的事，剩下的丢给下半部，因为中断上下文不能睡、不能等。',
      analogy: '中断像门铃，响了必须马上应一声，但你不能站在门口把客人聊完。先记下是谁，回头再慢慢接待。',
      example: '按键中断里只读状态、记时间戳、调度工作队列，消抖和上报放到 work_handler；用 cat /proc/interrupts 看计数有没有涨。',
      points: [
        '中断上下文不能睡眠，不能调用可能阻塞的函数',
        '上半部尽量快，几十微秒内就得返回',
        '下半部可选 tasklet、工作队列、线程化中断',
        '工作队列跑在进程上下文，可以睡眠',
        '共享数据要用自旋锁或关中断保护'
      ],
      detail: [
        '中断服务程序运行在中断上下文，没有自己的进程，内核不会给它调度。一旦在里面睡眠，整条中断线就卡住，严重时直接 oops。这段时间同优先级中断也进不来，系统像被按了暂停键。',
        '所以拆两半：上半部只清中断标志、读关键数据、把活排进队列；下半部再做耗时的事。判断标准很简单，要等、要睡、要申请内存，就往下半部放。只花几十条指令就能干完的事，别硬拆，拆了反而多一次调度开销。',
        '工作队列最常用，跑在内核线程里，可以睡眠；tasklet 更轻但不能睡；线程化中断把上半部也变成线程，实时性靠优先级调。数据共享别忘了加锁。选型就一句话：下半部要不要睡。'
      ],
      visual: null,
      pitfalls: [
        '中断里调用 msleep 或 copy_to_user，内核直接 oops：中断上下文不能睡眠、不能访问用户态。查法：看 dmesg 里的 BUG 栈，函数名一眼能认出来。',
        '中断计数在涨但应用收不到数据：下半部没调度成功，或队列满被丢弃。查法：cat /proc/interrupts 看计数，再在 handler 里加 printk 确认走到哪一步。'
      ],
      qa: [
        {
          q: '什么时候必须用工作队列，不能用 tasklet？',
          a: '下半部里要睡眠、要等信号量、要调用可能阻塞的 I2C 或 SPI 接口时，只能用工作队列。tasklet 仍在中断上下文，睡眠一样会出问题。'
        }
      ]
    }
  ]
};