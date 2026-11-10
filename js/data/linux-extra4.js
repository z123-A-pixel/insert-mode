export default {
  id: 'linux',
  chapters: [
    {
      id: 'lx-21',
      title: 'ESP32 深睡：电流从 20mA 降到 10uA',
      tags: ['低功耗', '深睡', 'ESP32'],
      level: 3,
      freq: 2,
      summary: '让 ESP32 大部分时间睡死，定时醒来干活，电池从几天撑到几个月。',
      analogy: '像门卫值夜班：平时裹被子睡觉，只在整点醒来看一眼监控，看完接着睡。醒了才耗电，睡着只剩呼吸。',
      example: '调 esp_deep_sleep_enable_timer_wakeup(10 * 1000000) 再 esp_deep_sleep_start()，板子断掉射频和 CPU，电流从 20mA 掉到 10uA，醒来等于复位。',
      points: [
        '深睡时 CPU、WiFi、蓝牙全断，只剩 RTC 域在计时',
        '唤醒等于重启，setup 会从头再跑一遍，变量清零',
        '要跨睡眠保存的数据放 RTC 内存，用 RTC_DATA_ATTR 标记',
        '定时唤醒靠 esp_sleep_enable_timer_wakeup 传微秒',
        '先量电流再优化，20mA 多半是有外设或上拉在漏电'
      ],
      detail: [
        'ESP32 有两块电源域。深睡时主域整体断电，CPU、WiFi、蓝牙全部停摆，只剩 RTC 域靠低速时钟数秒，所以电流能掉到 10uA 这个量级。代价是醒来相当于复位：程序从 setup 重新开始，普通全局变量全被清零，只有 RTC 内存那一小块还留着。',
        '写起来三步：算好睡多久，调 esp_sleep_enable_timer_wakeup 传微秒数；esp_deep_sleep_start 进睡；醒来读 esp_sleep_get_wakeup_cause 判断原因。要留的计数塞进 RTC_DATA_ATTR，别放普通变量。',
        '电流降不下来，先怀疑板子上的外设：稳压器静态电流、常亮 LED、上拉电阻、没断电的传感器。拔掉所有外设再测一次，能到 10uA 说明是外围在吃电。用万用表串在电池正极看平均电流，比盯瞬间值靠谱。'
      ],
      visual: null,
      pitfalls: [
        '睡下去电流还有几毫安：外设没断电或引脚悬空漏电。查法：拔掉外设单独测，万用表串电池看电流，再逐个接回。',
        '醒来数据丢了：变量放在普通 RAM，深睡会断电。查法：把变量改成 RTC_DATA_ATTR，醒来打印看看值还在不在。'
      ],
      qa: [
        {
          q: '深睡醒来后程序从哪开始跑？',
          a: '从 setup 开头重新跑，等同一次复位。RAM 里普通变量清零，只有 RTC_DATA_ATTR 标记的变量还留着。所以醒来第一件事是读唤醒原因，再决定接着干活还是重新初始化外设。'
        }
      ]
    },
    {
      id: 'lx-22',
      title: 'ESP32 双核：任务丢给 0 核还是 1 核',
      tags: ['双核', 'FreeRTOS', '任务分配'],
      level: 3,
      freq: 2,
      summary: '两个核分工：一个专管 WiFi 和协议栈，一个跑你的业务，别互相抢。',
      analogy: '像夫妻开店：一个守收银台接待客人，一个在后厨做菜。谁都能干两份活，但挤在一起就都慢。',
      example: '用 xTaskCreatePinnedToCore 建任务，最后一个参数写 1 就绑到 1 核，写 0 就绑 0 核。arduino 的 loop 默认在 1 核，WiFi 任务在 0 核，所以采样和刷屏都放 1 核。',
      points: [
        '0 核默认跑 WiFi 和蓝牙协议栈，别往上面塞重活',
        '1 核留给应用代码，arduino 的 loop 就在这里',
        'xTaskCreatePinnedToCore 最后一个参数就是核号',
        '核号写 tskNO_AFFINITY 表示两个核都能调度',
        '两个任务抢同一个变量，还是要加锁或用队列'
      ],
      detail: [
        'ESP32 是双核，但出厂分工明确：0 核跑 WiFi、蓝牙这些协议栈，1 核跑你的 setup 和 loop。不指定核的普通任务由调度器随便放，常常落进 0 核，跟协议栈抢时间片，表现为 WiFi 一忙，你的采样周期就抖。',
        '要指定核就用 xTaskCreatePinnedToCore，参数依次是函数、名字、栈大小、传参、优先级、句柄、核号。核号 0 或 1 是硬绑，tskNO_AFFINITY 是随缘。硬绑的好处是时序可预测，坏处是这个核忙死，另一个核闲着也帮不上。',
        '常见分法是：采集、控制、刷屏放 1 核；WiFi 收发、MQTT、OTA 交给 0 核。中间用队列传数据，别让两个核直接读写同一块缓冲区。两个核共享内存，但没有缓存一致性兜底，靠队列和互斥量才安全。'
      ],
      visual: null,
      pitfalls: [
        'WiFi 一连接，采样周期就乱：任务被放进 0 核跟协议栈抢。查法：打印 xPortGetCoreID 看任务落在哪个核，再用 xTaskCreatePinnedToCore 绑到 1 核。',
        '双核跑着跑着死机：两个任务同时改一个全局数组。查法：加互斥量或改成队列传递，用串口打印定位冲突那行。'
      ],
      qa: [
        {
          q: '任务绑核之后，另一个核闲着能帮忙吗？',
          a: '不能，硬绑就是只在这个核排队。核号写 tskNO_AFFINITY 才允许两边调度，但时序会飘。实时性要求高的活建议硬绑，把余量留在同一个核里算。'
        }
      ]
    },
    {
      id: 'lx-23',
      title: '嵌入式 Linux 面试最常问的五个问题',
      tags: ['面试', 'Linux', '八股'],
      level: 3,
      freq: 3,
      summary: '面试官爱问启动流程、驱动模型、内存、进程线程、调试手段这五块。',
      analogy: '像考驾照：路考翻来覆去就那几项，倒库、侧方、坡起。项目换过多少个，考的还是这几下。',
      example: '被问「内核起来第一件事做什么」，答 start_kernel 里初始化内存、调度、中断，最后找 init。被问驱动，就讲 file_operations 怎么把 open 和 read 接到你的函数。',
      points: [
        '启动流程：BootROM、uboot、start_kernel，最后 init',
        '驱动模型：设备树描述硬件，驱动匹配后注册字符设备',
        '内存：虚拟地址、页表、mmap，用户态看不到物理地址',
        '进程与线程：fork 复制地址空间，pthread 共享内存',
        '调试：dmesg、strace、gdb、perf 各管一段'
      ],
      detail: [
        '第一个必问启动流程。上电先跑芯片里的 BootROM，把 uboot 搬进内存；uboot 初始化 DDR、加载内核和设备树；内核进 start_kernel，配好内存管理、调度、中断，挂载根文件系统；最后拉起 init 进程。能按这条线讲清，面试官就知道你不是只会点灯。',
        '第二个是驱动。Linux 里一切皆文件，驱动就是给设备注册一套 file_operations，把 open、read、write、ioctl 接到自己的函数。硬件信息不写死在代码里，放在设备树，驱动靠 compatible 字符串匹配。换板子只改 dts，不动驱动。',
        '剩下三个是内存、进程线程、调试。内存要能说清虚拟地址和页表，用户态碰不到物理地址；进程线程要能说清 fork 复制地址空间、pthread 共享；调试要知道 dmesg 看内核日志、strace 看系统调用、gdb 远程挂、perf 找热点。答不上细节就说自己哪次用过，别硬编。'
      ],
      visual: null,
      pitfalls: [
        '被追问设备树就卡住：只背了驱动框架，没碰过 dts。查法：把板子的 dts 打开，找到自己那个外设的节点，看 compatible 和 reg 怎么写。',
        '问调试手段只会说 printf：没在实际项目里定位过问题。查法：找个死机日志，用 dmesg 加 addr2line 走一遍，把过程讲成故事。'
      ],
      qa: [
        {
          q: '面试问驱动怎么写，怎么答才不像背的？',
          a: '按一条线讲：设备树里加节点，驱动里写 probe，拿到资源后注册字符设备，把 file_operations 填上，再 insmod 加载、dmesg 看日志、应用层 open 验证。讲自己真跑通过的那一次，比背框架管用。'
        }
      ]
    },
    {
      id: 'lx-24',
      title: '单片机转 Linux：一条能走通的学习路线',
      tags: ['学习路线', '转型', 'Linux'],
      level: 3,
      freq: 2,
      summary: '别一上来啃内核，先把命令行、C 语言、系统编程、驱动按顺序走一遍。',
      analogy: '像从骑自行车换开货车：方向盘和刹车都会，但要重新学看后视镜、判车距、装货。旧本事不浪费，新规矩得认。',
      example: '第一周在 Ubuntu 上用熟 ls、grep、find、ssh、scp；第二周写 fork 和 pthread 的小程序；第三周交叉编译一个 hello 丢到板子上跑；第四周写个字符设备驱动 insmod 进去。',
      points: [
        '先把 Linux 命令行用顺，别急着看内核源码',
        'C 语言要补指针、结构体、内存管理这三块',
        '系统编程练 fork、pthread、socket、文件 IO',
        '学会交叉编译，把程序编到板子上跑通',
        '最后碰驱动：设备树、probe、字符设备'
      ],
      detail: [
        '第一步不是买书，是装个 Ubuntu 天天用。ls、cd、grep、find、chmod、ssh、scp 这些命令用熟，再看教程才不卡。很多人卡在第一步，是因为还用 Windows 的思路找图形界面，命令行这关绕不过去。',
        '第二步补 C。单片机上的 C 够用一半，缺的是指针的指针、结构体对齐、malloc 和 free 的边界。写几个链表、环形缓冲区、状态机，把手感找回来。Linux 下编译用 gcc 加 Makefile，别再用 IDE 点按钮。',
        '第三步系统编程，fork、wait、pthread、mutex、socket、open 和 read，这几样是应用层吃饭的本事。第四步交叉编译，把程序丢到板子上跑。第五步才碰驱动：设备树加节点、probe 拿资源、注册字符设备、insmod 验证。'
      ],
      visual: null,
      pitfalls: [
        '看内核源码三天就放弃：基础没打，直接啃调度器。查法：退回去把系统编程练熟，先能写能跑，再读源码。',
        '板子上跑不起来程序：忘了交叉编译或用错工具链。查法：file 看架构，ldd 看依赖，缺库就静态链接。'
      ],
      qa: [
        {
          q: '有单片机基础，转 Linux 大概要多久？',
          a: '每天两小时，命令行和 C 语言补两周，系统编程练一个月，交叉编译和驱动再一个月，三个月能上手做项目。想深入内核另算，那是按年计的活。'
        }
      ]
    },
    {
      id: 'lx-25',
      title: 'MCU、RTOS、Linux 怎么选：按需求和成本',
      tags: ['选型', 'RTOS', 'Linux'],
      level: 3,
      freq: 3,
      summary: '看三件事：要不要屏幕和网络、实时性多硬、BOM 能出多少钱。',
      analogy: '像选交通工具：买菜骑电动车，拉货开货车，跑长途坐高铁。不是越贵越好，是看这趟活要什么。',
      example: '做温控器：8 位 MCU 加裸机就够，BOM 几块钱。做带触摸屏和 WiFi 的网关：跑 Linux 的板子，8MB RAM 起步。中间那档，STM32 加 FreeRTOS 最划算。',
      points: [
        '裸机 MCU：成本最低，逻辑简单，实时性最好',
        'RTOS：任务多、要排队和延时，MCU 上加一层调度',
        'Linux：要屏幕、网络、文件系统、多进程才值得上',
        '算 BOM：Linux 方案内存和 Flash 起步就贵一截',
        '算人力：Linux 招人贵，调试链路也长'
      ],
      detail: [
        '先问需求。要不要彩屏、要不要跑网页、要不要存大量日志、要不要同时干好几件事。只要一个按键加一个继电器，裸机 MCU 足够，几块钱的片子就能干，还没有开机时间。硬上 Linux，成本和工期都翻倍。',
        '中间地带用 RTOS。任务变多、要延时又要响应、串口和传感器同时收，裸机的状态机就写成面条了。这时上 FreeRTOS 或 RT-Thread，任务、队列、信号量把结构理清，芯片还是那颗几块钱的 MCU，实时性也还在。',
        '真需要 Linux 的信号是：屏幕要跑图形界面、要 TCP 协议栈和文件系统、要跑 Python 或数据库、要多个进程互不干扰。代价是内存至少 8MB RAM、Flash 几十兆、开机几十秒、BOM 贵几倍。选型看需求，也看团队会不会维护。'
      ],
      visual: null,
      pitfalls: [
        '上了 Linux 才发现实时性不够：控制环要微秒级，Linux 调度给不了。查法：量一遍最坏响应时间，硬实时那段拆给 MCU 或加 RT 补丁。',
        'MCU 上堆功能堆到崩：任务一多，裸机状态机乱成一团。查法：数一遍并发任务和延时需求，超过五六个就换 RTOS。'
      ],
      qa: [
        {
          q: '老板说用 Linux 显得高级，怎么回？',
          a: '先算账：Linux 方案内存和 Flash 贵几倍，开机几十秒，还要人维护。需求里没有屏幕、网络、文件系统，就用 MCU 加 RTOS，省钱省工期。把 BOM 和工时列出来，比争技术高低有用。'
        }
      ]
    }
  ]
};