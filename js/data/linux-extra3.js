export default {
  id: 'linux',
  chapters: [
    {
      id: 'lx-15',
      title: 'RT-Thread 和 FreeRTOS 差在哪',
      tags: ['RT-Thread', 'FreeRTOS', '选型'],
      level: 2,
      freq: 3,
      summary: 'FreeRTOS 和 RT-Thread 都能跑多任务，后者多出设备框架、命令行和软件包。',
      analogy: 'FreeRTOS 像一间空车间，机器能转，扳手要自己找；RT-Thread 像精装房，床、灶、插座都留好了位置。',
      example: '项目从 FreeRTOS 迁到 RT-Thread：xTaskCreate 改成 rt_thread_create，GPIO 直写改成 rt_device_find 找 pin 设备再 open、write，串口调试多了 msh。',
      points: [
        'FreeRTOS 只做内核，驱动和命令行要自己配',
        'RT-Thread 自带设备框架，换芯片少改应用层',
        'RT-Thread 默认带 msh，板子上能直接敲命令',
        '软件包和组件更多，但代码体积也会大一些',
        '两者都支持抢占调度，实时性差距看配置'
      ],
      detail: [
        'FreeRTOS 的定位是小内核：任务、队列、信号量、软件定时器，够用就停。驱动、串口 shell、文件系统都要自己找第三方或手写。好处是裁剪后只有几 KB，坏处是每个项目都在重复造轮子。',
        'RT-Thread 在内核外又包了一层：设备框架把串口、I2C、SPI 统一成 rt_device，应用只认设备名；msh 让你在串口上查线程、内存和设备；软件包把网络、文件系统做成可选项。',
        '选型看团队和交付：只做电机控制、RAM 只有十几 KB，FreeRTOS 更轻；要快速联网、做多外设、还要现场调试，RT-Thread 省时间。两者都能上生产，差别在配套，不在谁的调度更高级。'
      ],
      visual: null,
      pitfalls: [
        '移植后串口一直没输出：RT-Thread 的控制台没绑对设备。查法：msh 里执行 list_device，看 uart1 是否打开，再核对 rt_console_set_device 的参数。',
        '任务能跑但内存一点点少：栈给小了或线程没删。查法：msh 执行 free 和 ps，看剩余内存与线程栈使用率，再调线程栈大小和优先级。'
      ],
      qa: [
        {
          q: 'FreeRTOS 和 RT-Thread 的调度差很多吗？',
          a: '核心都是优先级抢占加时间片，实时性差不了多少。差别在配套：RT-Thread 多设备框架、命令行和软件包，FreeRTOS 更小更纯。选哪个看内存预算和要不要现成组件。'
        }
      ]
    },
    {
      id: 'lx-16',
      title: 'RT-Thread 设备框架：open 和 read 也能用在单片机上',
      tags: ['设备框架', 'rt_device', '驱动'],
      level: 2,
      freq: 3,
      summary: '单片机也能用 open、read、write 操作外设，靠设备框架把驱动统一成文件接口。',
      analogy: '设备框架像小区快递柜：不管里面是顺丰还是京东，你都按「扫码、开门、取件」三步走，不用认识每个快递员。',
      example: 'rt_device_find 传入 uart2，rt_device_open 用 RT_DEVICE_FLAG_RDWR 打开，rt_device_read 读 10 字节；应用层 open /dev/uart2 后 read 也通。',
      points: [
        '设备驱动注册后挂到名字上，应用只认名字',
        'find 拿句柄，open 选读写权限，read 收数据',
        'write 和 control 管发送与波特率等参数',
        '同一套接口能套串口、I2C、SPI、pin',
        'POSIX 层把 /dev 节点映射到设备框架'
      ],
      detail: [
        '传统写法是应用直接调 HAL 库，换颗芯片就要改一片代码。设备框架在中间加一层：驱动启动时用 rt_device_register 把设备挂到名字上，应用只写 rt_device_find 加 open，底层换不换芯片与上层无关。',
        'open 的第二个参数是权限：只读、只写、读写，还可以带中断接收、DMA 等标志。read 的第三个参数是缓冲区，第四个是长度，返回实际读到的字节数。超时用 RT_WAITING_FOREVER 或具体 tick 数。',
        '很多人以为设备框架只能用于 RT-Thread 内核对象，打开 CONFIG_RT_USING_POSIX 后，应用可以像 Linux 一样 open /dev/uart2、read、close。驱动不用重写，同一份设备注册代码同时服务两套接口。'
      ],
      visual: null,
      pitfalls: [
        'rt_device_find 返回 NULL：名字写错或驱动没注册。查法：msh 里 list_device 看设备名，确认驱动初始化在 find 之前跑完。',
        'read 一直返回 0：设备没打开或没开接收。查法：核对 open 的标志位，串口要加 RT_DEVICE_FLAG_RX 或中断接收，再看缓冲区长度。'
      ],
      qa: [
        {
          q: '应用怎么知道要找哪个设备名？',
          a: '设备名由驱动注册时定，常见有 uart1、i2c1、spi1、pin。先看板级初始化和 list_device 的输出，名字要一字不差。拿不准就搜工程里的 rt_device_register 调用。'
        }
      ]
    },
    {
      id: 'lx-17',
      title: 'MSH 命令行：板子上的 shell 怎么用',
      tags: ['MSH', 'finsh', '命令行'],
      level: 1,
      freq: 3,
      summary: 'MSH 是跑在板子上的命令行，串口连上就能查线程、内存、设备，还能调自己导出的函数。',
      analogy: '像给板子装了个对讲机：不用改代码重烧，对着串口喊一句，它就把线程、内存、设备的现状报给你。',
      example: '串口 115200 连上，回车出现 msh>，敲 list_device 看设备、free 看内存、ps 看线程；自定义命令用 MSH_CMD_EXPORT(led_on, turn led on) 导出，重启后就能直接敲 led_on。',
      points: [
        'msh> 是提示符，回车执行一条命令',
        'help 或 Tab 能列出并补全命令',
        'list_device、free、ps 是最常用的三把刀',
        'MSH_CMD_EXPORT 把函数变成可执行命令',
        '命令跑在 shell 线程里，别塞死循环'
      ],
      detail: [
        'MSH 全称是 module shell，跑在 finsh 组件上。板子启动时初始化串口控制台，你敲的字符从串口进，命令解析后调用对应函数，输出再原路返回。默认波特率常见 115200，8N1。',
        '自带命令覆盖常用排查：list_device 看设备注册，free 看堆内存，ps 看线程状态和栈使用，date 看时间，ifconfig 看网卡。命令名不顺手的可以先用 help 查，再决定要不要裁掉省空间。',
        '把函数导出成命令只要一行：MSH_CMD_EXPORT(函数名, 说明)。函数签名要带 argc 和 argv，像 main 一样接参数。导出后重新编译烧录，在 msh 里敲函数名就行，调试寄存器时特别省事。'
      ],
      visual: null,
      pitfalls: [
        '敲命令提示 command not found：命令没编进固件或拼写不对。查法：msh 里输 help 看列表，再搜代码里有没有 MSH_CMD_EXPORT。',
        '一敲命令板子就卡死：导出函数里写了死循环或长延时。查法：ps 看哪个线程占满 CPU，把阻塞改成 rt_thread_mdelay。'
      ],
      qa: [
        {
          q: 'MSH 和 Linux 的 shell 是一回事吗？',
          a: '思路像，体量差很远。MSH 是 RT-Thread 自带的轻量 shell，命令是编译进固件的函数，没有独立进程和管道。Linux shell 能起程序、重定向、写脚本，MSH 主要用来现场查状态。'
        }
      ]
    },
    {
      id: 'lx-18',
      title: 'ESP-IDF 工程结构：app_main 和各组件',
      tags: ['ESP-IDF', 'app_main', '组件'],
      level: 2,
      freq: 3,
      summary: 'ESP-IDF 把工程拆成 main 和 components，入口是 app_main。',
      analogy: '像一家餐厅：app_main 是开门后第一件事，components 是后厨、前台、仓库，各自有菜谱和进货单，CMakeLists 是总调度。',
      example: 'idf.py create-project demo 建工程，在 main/app_main.c 写 app_main，idf.py menuconfig 改 tick，idf.py build 后 flash monitor 看日志。',
      points: [
        'app_main 是应用入口，跑在 main 任务里',
        '每个组件一个目录，带 CMakeLists 和头文件',
        '组件靠 REQUIRES 声明依赖，别互相乱引',
        'sdkconfig 由 menuconfig 生成，别手改',
        'build 目录可整目录删掉重来'
      ],
      detail: [
        '工程根目录有 CMakeLists、sdkconfig、main 和 components。main 本身也是一个组件，里面放 app_main。启动时 ESP-IDF 先跑系统初始化，再创建 main 任务，最后调用 app_main，串口打印和 WiFi 初始化都从这里开始。',
        '自己加组件就在 components 下建目录，写 CMakeLists.txt，用 idf_component_register 登记源文件和头文件路径。别的组件要用它，就在 REQUIRES 里写名字，编译系统会自动排依赖顺序。',
        'menuconfig 改的是 sdkconfig，Flash 大小、分区表、FreeRTOS 频率、日志级别都在里面。改完执行 idf.py build，配置会参与编译。sdkconfig 建议进版本库，sdkconfig.old 不用。'
      ],
      visual: null,
      pitfalls: [
        '编译报 undefined reference：组件没写进 REQUIRES 或函数没声明。查法：看报错里的组件名，检查 CMakeLists 的 REQUIRES 和头文件包含路径。',
        '改了 menuconfig 不生效：build 目录缓存了旧配置。查法：idf.py fullclean 后重新 build，再看 sdkconfig 里对应项的值。'
      ],
      qa: [
        {
          q: 'app_main 返回后程序会退出吗？',
          a: '不会。app_main 跑在 main 任务里，返回后这个任务被删除，但调度器和别的任务还在跑。常驻逻辑要单独建任务，别把死循环塞在 app_main 里。'
        }
      ]
    },
    {
      id: 'lx-19',
      title: 'ESP32 分区表与 OTA：两块 app 分区怎么切',
      tags: ['分区表', 'OTA', 'ota_0'],
      level: 3,
      freq: 2,
      summary: 'Flash 按分区表切块，OTA 在 ota_0 和 ota_1 之间切换，失败还能回滚。',
      analogy: '像给手机装双系统：A 系统在用时，新版本悄悄写进 B 区；重启切到 B，出问题还能切回 A。',
      example: 'partitions.csv 写 ota_0、ota_1 各1M，otadata 8K；idf.py partition-table，esp_ota_begin 写 ota_1，esp_ota_set_boot_partition 后重启。',
      points: [
        '分区表定每块 Flash 的偏移和大小',
        'factory 是出厂区，ota_0 和 ota_1 轮流用',
        'otadata 记录当前从哪块启动',
        'OTA 写入前先擦除，写完要校验',
        '新固件起不来时能自动回滚到旧分区'
      ],
      detail: [
        'ESP32 的 Flash 不只是一个固件，前面有 bootloader 和分区表，后面按行切：nvs 存配网信息，phy_init 存射频校准，factory 或 ota_0 放应用，otadata 记启动选择。分区表就是一张地址分配单，写错偏移会直接覆盖别的数据。',
        'OTA 流程是：连上服务器，读版本号，把新固件按块写进另一个 app 分区，写完校验，再把 otadata 指向新分区，最后重启。重启后 bootloader 看 otadata 决定加载哪块，失败时可以回滚到上一版。',
        '做产品要留余量：app 分区至少比固件大 20%，两个 OTA 区加 otadata 会吃掉不少 Flash。量产前用 idf.py partition-table 检查布局，再用 esptool.py read_flash 核对实际内容，别等升级时才发现放不下。'
      ],
      visual: null,
      pitfalls: [
        'OTA 后重启还是旧版本：otadata 没切或写入校验失败。查法：串口看启动日志里的 boot partition，再调 esp_ota_get_running_partition 打印当前分区。',
        '编译报 app partition is too small：分区表给 app 的空间小于固件。查法：看 build 输出的 bin 大小，改 partitions.csv 里 ota_0 的 size，重新生成分区表。'
      ],
      qa: [
        {
          q: 'OTA 为什么要两个 app 分区？',
          a: '一个在跑，另一个才能安心写入。写完切换启动分区，旧固件还留在原地，新版本起不来可以回滚。只有一个分区就得先擦掉正在跑的固件，断电就变砖。'
        }
      ]
    },
    {
      id: 'lx-20',
      title: 'ESP32 WiFi 配网：三种常见方式',
      tags: ['WiFi', '配网', 'SmartConfig'],
      level: 2,
      freq: 3,
      summary: '设备不知道你家 WiFi 密码，得靠手机把 SSID 和密码传过去，常见三种配网方式。',
      analogy: '像新来的室友不知道门禁密码：SmartConfig 是你在门口喊一嗓子，SoftAP 是他先开个临时门，BLE 配网是贴张二维码让他扫。',
      example: 'esp_smartconfig_set_type(SC_TYPE_ESPTOUCH_V2) 启动配网；SoftAP 开热点让手机填表；BLE 走 wifi_prov_mgr_start_provisioning。',
      points: [
        'SmartConfig 靠广播包传密码，不用先连设备',
        'SoftAP 让设备开热点，手机连上去填表',
        'BLE 配网体验好，代码和内存开销更大',
        '配网成功要把 SSID 和密码写进 nvs',
        '量产要留按键复位，否则换路由器就抓瞎'
      ],
      detail: [
        'SmartConfig 也叫 ESP-Touch：手机把 SSID 和密码编码进一组特殊长度的 WiFi 包，设备在混杂模式下抓包还原。优点是不用切热点，缺点是依赖手机 App 和路由器兼容性，5G 频段不参与。',
        'SoftAP 反过来：设备先开一个热点，手机连上后打开网页或 App，把家里路由器的账号密码提交给设备，设备再切回 STA 模式连接。流程稳，但用户要多连一次热点，体验略绕。',
        'BLE 配网用蓝牙通道传凭据，手机不用连设备热点，成功率也高。ESP-IDF 提供 wifi_prov_mgr 组件，三种方式可以共用一套回调。配网成功后把凭据写进 nvs，下次上电直接连。'
      ],
      visual: null,
      pitfalls: [
        '手机显示配网成功，设备却连不上：密码错或路由器开了隔离。查法：串口看 esp_wifi_connect 返回码，核对 SSID 大小写，再用手机热点交叉验证。',
        '换路由器后设备变砖：没留重新配网入口。查法：加长按按键清 nvs 并重启配网，或在 App 里做解绑，别只靠第一次配网。'
      ],
      qa: [
        {
          q: '三种配网方式怎么选？',
          a: '看产品形态。有屏幕和按键，SoftAP 网页配网最稳；只有小模组、要快，SmartConfig 成本低；追求体验和成功率，选 BLE 配网。量产常把两种做在一起，失败能自动切换。'
        }
      ]
    }
  ]
};