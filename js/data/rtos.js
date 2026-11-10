export default {
  "id": "rtos",
  "title": "FreeRTOS",
  "subtitle": "任务调度、同步机制、内存与中断",
  "accent": "#BF5AF2",
  "icon": "layers",
  "chapters": [
    {
      "id": "rtos-01",
      "title": "任务到底是什么：栈、TCB 与切换过程",
      "tags": [
        "任务",
        "TCB",
        "上下文切换"
      ],
      "level": 1,
      "summary": "每个任务独享一块栈和一份记录本，换人跑之前先把现场存好，回来才能接着干。",
      "points": [
        "栈大小单位是字，xTaskCreate 的 128 表示 512 字节",
        "TCB_t 保存栈顶、优先级、状态和事件链表项",
        "PendSV 负责上下文切换，SVC 负责启动第一个任务",
        "任务栈溢出会踩坏相邻内存，现象是随机 HardFault"
      ],
      "detail": [
        "xTaskCreate 先从堆分配 TCB_t 和任务栈，再把初始上下文伪造成「刚被中断」的栈帧：xPSR 的 T 位、PC 指向任务函数、LR 指向 prvTaskExitError。pxCurrentTCB 始终指向正在运行的任务，TCB_t 里的 pxTopOfStack 保存最新栈顶。",
        "PendSV 被配置为最低优先级，确保中断嵌套结束后才切换。异常进入时硬件自动压 R0-R3、R12、LR、PC、xPSR 八个寄存器，PendSV 里再用 portSAVE_CONTEXT 压 R4-R11，然后把 PSP 存入旧 TCB，从新 TCB 恢复。",
        "栈单位是 StackType_t，Cortex-M 上为 4 字节，所以 128 是 512 字节。估算要把调用深度、局部数组、printf 和浮点上下文都算进去，剩余用 uxTaskGetStackHighWaterMark 观察，低于 20% 就要加。"
      ],
      "visual": "sched",
      "pitfalls": [
        "把 128 当成 128 字节，深调用后栈顶越过 TCB，切到别的任务就 HardFault；用 uxTaskGetStackHighWaterMark 看余量，并打开 configCHECK_FOR_STACK_OVERFLOW。"
      ],
      "qa": [
        {
          "q": "FreeRTOS 任务切换时保存了哪些寄存器，为什么是 16 个？",
          "a": "异常硬件自动压 R0-R3、R12、LR、PC、xPSR 共 8 个，PendSV 再压 R4-R11 共 8 个，合计 16 个。开启 FPU 还要保存 S0-S15 和 FPSCR，栈要留余量。"
        }
      ],
      "freq": 3,
      "analogy": "任务像几个并行的厨师，每人一块专属案板（栈）和一个工牌（TCB），锅只有一个，换人上灶前先把手上动作记到工牌背面。",
      "example": "xTaskCreate 的第四个参数传了局部数组地址，任务里读出来全是野值，因为函数返回后栈早被回收。改成用 static 缓冲区，或直接 xTaskCreateStatic 由你提供栈和 TCB，现象就没了。"
    },
    {
      "id": "rtos-02",
      "title": "xTaskCreate 背后：TCB_t 里到底存了什么",
      "tags": [
        "任务创建",
        "TCB",
        "源码"
      ],
      "level": 1,
      "summary": "建任务就是领一块内存当记录本，把入口、优先级、栈顶填好，再挂到队列里等 CPU。",
      "points": [
        "xTaskCreate 的参数依次是函数、名字、栈深、参数、优先级、句柄",
        "TCB_t 存 pxTopOfStack、优先级和状态链表项",
        "静态创建用 xTaskCreateStatic，内存由用户提供",
        "创建后任务进入就绪态，调度器启动后才可能运行"
      ],
      "detail": [
        "xTaskCreate 的栈深参数单位是字，不是字节；第四个参数是传给任务函数的 void 指针，句柄用来 vTaskDelete、改优先级和查状态。创建失败通常返回 errCOULD_NOT_ALLOCATE_REQUIRED_MEMORY，根源是 configTOTAL_HEAP_SIZE 不够或碎片。",
        "TCB_t 关键字段有 pxTopOfStack、uxPriority、uxBasePriority、eTaskState、xStateListItem 和 pcTaskName。就绪、阻塞、挂起分别挂在不同的链表上，切换时移动链表节点并更新 pxCurrentTCB。",
        "prvInitialiseNewTask 会填栈魔数、构造初始栈帧，并把任务插入就绪链表。优先级高于当前任务时立刻触发一次 PendSV，所以创建高优先级任务后不一定会回到创建者继续执行。"
      ],
      "visual": "states",
      "pitfalls": [
        "创建 10 个任务只成功 3 个，返回 errCOULD_NOT_ALLOCATE_REQUIRED_MEMORY；原因是堆不够或每任务栈过大；查 xPortGetFreeHeapSize 和 uxTaskGetStackHighWaterMark。"
      ],
      "qa": [
        {
          "q": "xTaskCreate 和 xTaskCreateStatic 有什么区别，什么时候选静态？",
          "a": "xTaskCreate 从 FreeRTOS 堆分配 TCB 和栈，失败返回错误码；xTaskCreateStatic 由调用者提供 TCB_t 和栈数组，编译期就能确定内存，不会因堆碎片失败，适合安全关键或禁止动态分配的项目。"
        }
      ],
      "freq": 3,
      "analogy": "xTaskCreate 像给新员工办入职：发工位（栈）、填工牌（TCB）、写明岗位级别（优先级），再把工牌挂到对应级别的待命栏（就绪链表）。",
      "example": "连建 10 个任务只成功 3 个，xTaskCreate 返回 errCOULD_NOT_ALLOCATE_REQUIRED_MEMORY。看堆只剩 2 KB，把每个任务栈从 512 字降到 256 字，10 个全建起来了。"
    },
    {
      "id": "rtos-03",
      "title": "栈多大才够：估算、高水位与两种溢出检测",
      "tags": [
        "栈",
        "溢出",
        "调试"
      ],
      "level": 2,
      "summary": "栈是任务自己的草稿纸，按最深调用链留够，再靠高水位看还剩多少空白。",
      "points": [
        "先算最深调用链的局部变量、返回地址和对齐开销",
        "uxTaskGetStackHighWaterMark 返回历史最小剩余字",
        "方法一填魔数 0xA5，方法二检查栈指针越界",
        "中断和 FPU 上下文也压在当前任务栈上"
      ],
      "detail": [
        "估算时从任务入口沿最深调用链累加：每层返回地址和寄存器、局部数组、printf 的缓冲区、浮点运算保存的 S0-S15。Cortex-M 中断也使用当前任务栈，最坏中断嵌套要额外留 100 到 200 字节，不能只按平均负载算。",
        "方法一创建时把栈填成 0xA5，切换时数栈底连续 0xA5，即 uxTaskGetStackHighWaterMark 的高水位；方法二在 configCHECK_FOR_STACK_OVERFLOW 为 2 时检查栈指针是否越过 pxStack，越界进 vApplicationStackOverflowHook。",
        "两种方法各有盲区：魔数法只能发现写过又被覆盖的区域，指针检查只在切换点采样。上线前把高水位打到日志，保留 30% 余量；若某任务只剩 20 字，增加 64 到 128 字比事后调 HardFault 便宜得多。"
      ],
      "visual": null,
      "pitfalls": [
        "任务平时正常，一进中断就随机死机；原因是中断栈叠加导致溢出；查高水位、打开溢出钩子并打印 pcTaskName 和 pxCurrentTCB。"
      ],
      "qa": [
        {
          "q": "uxTaskGetStackHighWaterMark 返回 12 说明什么？",
          "a": "说明该任务历史上栈剩余最小只有 12 个字，约 48 字节。这个值越小越危险，通常要保留总栈深的 20% 到 30%。若接近 0，应增大 xTaskCreate 的栈深参数，或减少深调用和大局部数组。"
        }
      ],
      "freq": 3,
      "analogy": "栈像一人一张草稿纸，写函数就往上摞草稿；纸太小会写到隔壁桌上（踩坏内存），所以既要留富余，也要常看还剩几行空白。",
      "example": "任务平时正常，一收串口数据就随机 HardFault。uxTaskGetStackHighWaterMark 一看只剩 8 个字，中断压栈加 printf 把栈顶冲了。栈深从 128 提到 256，再开溢出检查复测。"
    },
    {
      "id": "rtos-04",
      "title": "任务状态机：运行、就绪、阻塞、挂起怎么切",
      "tags": [
        "任务状态",
        "状态机",
        "调度"
      ],
      "level": 1,
      "summary": "任务一辈子就四种状态，等事件进阻塞，被叫停进挂起，剩下交给调度器安排。",
      "points": [
        "就绪态在就绪链表排队，运行态同一时刻只有一个",
        "阻塞态由 vTaskDelay、队列或信号量超时进入",
        "挂起态用 vTaskSuspend 进入，恢复用 vTaskResume",
        "阻塞超时返回 pdFALSE，任务被唤醒后回到就绪"
      ],
      "detail": [
        "运行到就绪发生在被更高优先级任务抢占、时间片用完或主动 taskYIELD。就绪到运行由调度器选最高优先级；阻塞到就绪是等待的事件发生或超时到期，挂起到就绪只能由 vTaskResume 或 xTaskResumeFromISR 触发。",
        "xQueueReceive 的阻塞时间单位是 tick，0 表示不阻塞，portMAX_DELAY 表示无限等待，依赖 INCLUDE_vTaskSuspend 为 1。vTaskDelay 的 10 在 1000 Hz 下是 10 ms，它是相对延时，会被同优先级挤占，周期任务应用 vTaskDelayUntil。",
        "删除任务用 vTaskDelete，删除自身后内存由空闲任务回收；若空闲任务被饿死，TCB 和栈不会释放。调试时用 uxTaskGetSystemState 一次拿到所有任务的状态、优先级和栈高水位，比逐个打印更可靠。"
      ],
      "visual": "states",
      "pitfalls": [
        "任务明明在等队列却永远不醒；原因是发送方用了 xQueueSend 的 0 超时且队列满，或中断里没调用 portYIELD_FROM_ISR；查队列计数、发送返回值和阻塞时间。"
      ],
      "qa": [
        {
          "q": "vTaskDelay 和 vTaskDelayUntil 有什么区别？",
          "a": "vTaskDelay 从调用时刻起相对延时，任务执行时间波动会累积周期误差；vTaskDelayUntil 以绝对 tick 为基准，按固定周期唤醒，适合采样和控制循环。周期小于任务执行时间时会立即返回并持续报警。"
        }
      ],
      "freq": 3,
      "analogy": "状态机像餐厅服务员：正在干活是运行，在排队等号是就绪，在等客人点单是阻塞（带超时），被经理叫去开会是挂起，不接单。",
      "example": "xQueueReceive 里写了 portMAX_DELAY，发送端队列满时又只用 xQueueSend 的 0 超时，接收任务永远不醒。打印发送返回值才看到 errQUEUE_FULL，发送端改成也等 10 个 tick，任务立刻活了。"
    },
    {
      "id": "rtos-05",
      "title": "优先级抢占与同优先级时间片",
      "tags": [
        "抢占",
        "时间片",
        "调度"
      ],
      "level": 1,
      "summary": "优先级决定谁先上 CPU，同优先级再按时间片轮流，抢占开关决定能不能插队。",
      "points": [
        "数值越大优先级越高，configMAX_PRIORITIES 决定上限",
        "高优先级任务就绪会立刻触发 PendSV 抢占",
        "同优先级按时间片轮转，一个 tick 切一次",
        "关抢占只能靠临界区或调度器挂起，不能只关时间片"
      ],
      "detail": [
        "configUSE_PREEMPTION 为 1 时，中断或 API 唤醒更高优先级任务，退出中断前会置 PendSV 挂起位，返回后立刻切换。为 0 时变成协作式，必须任务主动 taskYIELD，实时性靠程序员保证，实际项目很少这么配。",
        "configUSE_TIME_SLICING 为 1 时，同优先级任务在 SysTick 中断里轮转，每个 tick 检查一次；为 0 时同优先级不主动切换，先运行的任务一直占 CPU 直到阻塞。configTICK_RATE_HZ 设 1000 时一个时间片就是 1 ms，节拍越高手册开销越大。",
        "优先级不能随便给满，configMAX_PRIORITIES 常见配 5 到 8。优先级分配要体现截止时间：控制环最高、通信中等、日志最低。若所有任务同优先级又开了时间片，响应抖动会变大，硬实时任务应独占较高优先级。"
      ],
      "visual": "sched",
      "pitfalls": [
        "高优先级任务一来系统就卡死；原因是它在等低优先级任务释放的资源，形成优先级反转；查阻塞点并给共享资源加互斥量，确认高优先级任务没有忙等。"
      ],
      "qa": [
        {
          "q": "configUSE_PREEMPTION 为 0 时系统还是实时系统吗？",
          "a": "仍是 RTOS，但调度变成协作式，任务不主动让出 CPU 就不会切换，高优先级任务的响应时间取决于低优先级任务何时阻塞。只有所有任务都自觉短小并频繁让出时才可用，硬实时场景一般保持抢占。"
        }
      ],
      "freq": 3,
      "analogy": "像医院分诊：号码大的（优先级高）随时插到队首，号码一样的每人看一分钟轮流来，时间片就是那一分钟。",
      "example": "configUSE_PREEMPTION 设 1，按键任务优先级 5，日志任务优先级 1。日志里一句 printf 占 3 ms，按键响应肉眼可见地卡。日志降到 0 改成队列攒批输出，实测响应回到 200 微秒内。"
    },
    {
      "id": "rtos-06",
      "title": "就绪链表、PendSV 与 SVC：切换的源码路径",
      "tags": [
        "就绪链表",
        "PendSV",
        "SVC"
      ],
      "level": 2,
      "summary": "内核按优先级维护一串就绪链表挑下一个任务，真正换人交给最低优先级的 PendSV。",
      "points": [
        "pxReadyTasksLists 每个优先级一条链表，位图加速查找",
        "taskSELECT_HIGHEST_PRIORITY_TASK 取最高非空链表",
        "PendSV 配最低优先级，保证不在中断中间切换",
        "SVC 在 vTaskStartScheduler 里启动第一个任务"
      ],
      "detail": [
        "FreeRTOS 为每个优先级维护一条 pxReadyTasksLists，并用 uxTopReadyPriority 记录当前最高就绪优先级。任务就绪时把对应位置 1，选择任务时从高到低找第一条非空链表，取表头节点得到 TCB，再赋给 pxCurrentTCB。",
        "PendSV 被设为最低优先级，任何中断都能打断它之前的请求，但不会打断正在执行的中断服务程序。xPortPendSVHandler 先取 pxCurrentTCB，用 portSAVE_CONTEXT 把 R4-R11 压入当前 PSP，再调用 vTaskSwitchContext 选新任务，最后从新 TCB 恢复。",
        "第一个任务不是 PendSV 启动的，而是 vTaskStartScheduler 里的 SVC 0。SVC 处理程序把栈帧弹出，用异常返回技巧跳到任务入口；此时 MSP 留给内核和中断，PSP 给任务使用，双栈结构让任务栈溢出不至于立刻踩内核。"
      ],
      "visual": "sched",
      "pitfalls": [
        "PendSV 优先级配得比 SysTick 高，切换时把 tick 中断挡住；原因是优先级数值写反；查 NVIC 的 PRIO 位和 configKERNEL_INTERRUPT_PRIORITY，PendSV 和 SysTick 都应是最低。"
      ],
      "qa": [
        {
          "q": "为什么 FreeRTOS 用 PendSV 做上下文切换而不是在 SysTick 里直接切？",
          "a": "SysTick 可能被更高优先级中断打断，直接切会破坏现场；PendSV 设为最低优先级，可挂起等待所有中断处理完再统一切换，既简化栈管理又缩短中断延迟，还允许在中断里只置位不立即切换。"
        }
      ],
      "freq": 2,
      "analogy": "就绪链表像按优先级分好的候诊队列，PendSV 像叫号广播：只有所有急诊都处理完广播才响，保证换人时没人正躺在手术台上。",
      "example": "把 PendSV 的 NVIC 优先级写成 5，比 SysTick 还高，串口一来大数据 tick 被拖住，vTaskDelay 就偏长。改成最低位并用 configKERNEL_INTERRUPT_PRIORITY 统一配置，延时正常了。"
    },
    {
      "id": "rtos-07",
      "title": "vTaskDelayUntil：周期任务不漂移的写法",
      "tags": [
        "周期任务",
        "延时",
        "调度"
      ],
      "level": 2,
      "summary": "周期任务按绝对时刻唤醒，任务算得慢一点也不会把周期越拖越长。",
      "points": [
        "先记录 xLastWakeTime，再在循环里传固定周期",
        "周期小于执行时间会立即返回，必须检查返回值",
        "tick 回绕时用无符号减法比较，不要直接比大小",
        "控制环周期常用 1 ms、5 ms、10 ms 对应 tick"
      ],
      "detail": [
        "vTaskDelayUntil 的参数是上一次唤醒 tick 和周期 tick，函数内部把 xLastWakeTime 加上周期，再调用 xTaskDelayUntil 等到新时刻。它不关心任务本身跑了多久，因此 1 ms 控制环不会因为计算量波动而变成 1.2 ms、1.4 ms。",
        "若任务执行时间超过周期，函数会立刻返回，xLastWakeTime 仍按周期递增，结果是连续多个周期被压缩。正确做法是统计超时次数并降低周期或拆分任务，而不是把周期改大掩盖问题。tick 回绕时用 TickType_t 无符号减法判断先后。",
        "configTICK_RATE_HZ 为 1000 时，1 个 tick 等于 1 ms，vTaskDelayUntil 的最小有效周期就是 1 ms。需要更细的抖动控制时，用硬件定时器触发中断，在 ISR 里给任务通知，不依赖 tick 精度。"
      ],
      "visual": "sched",
      "pitfalls": [
        "电机控制周期越来越长；原因是循环里用了 vTaskDelay 且计算时间波动；改成 vTaskDelayUntil 并记录超时次数，用 GPIO 翻转配合示波器测实际周期。"
      ],
      "qa": [
        {
          "q": "vTaskDelayUntil 的周期设为 5，任务却跑了 8 个 tick，会发生什么？",
          "a": "函数发现目标唤醒时刻已经过去，会立即返回，后续周期继续按 5 个 tick 累加，任务实际变成背靠背执行。应把超时计数打出来，缩短任务或增大周期，不能让绝对基准被任务执行时间拖垮。"
        }
      ],
      "freq": 3,
      "analogy": "像地铁按时刻表发车：vTaskDelay 是干完活再歇 5 分钟，越干越晚；vTaskDelayUntil 是每 5 分钟一班，活干快了也得等到点。",
      "example": "电机环里用 vTaskDelay(5)，计算一多周期就从 5 ms 漂到 7 ms，转速跟着抖。换成 vTaskDelayUntil(&xLastWakeTime, 5)，GPIO 翻转配示波器测，周期稳在 5 ms。"
    },
    {
      "id": "rtos-08",
      "title": "空闲任务、钩子函数与 tickless 低功耗",
      "tags": [
        "空闲任务",
        "tickless",
        "低功耗"
      ],
      "level": 2,
      "summary": "空闲任务是最低优先级的收尾工，回收被删任务的内存，还顺手把低功耗撑起来。",
      "points": [
        "空闲任务优先级 0，不能被删除，必须留出运行机会",
        "vApplicationIdleHook 不能阻塞，也不能调用阻塞 API",
        "configUSE_TICKLESS_IDLE 为 1 时按下一个唤醒时刻补偿 tick",
        "低功耗唤醒后要调用 eTaskConfirmSleepModeStatus 确认"
      ],
      "detail": [
        "空闲任务在 vTaskStartScheduler 里自动创建，优先级为 tskIDLE_PRIORITY 即 0。vTaskDelete 删除的任务，其 TCB 和栈由空闲任务释放；如果应用长期占满 CPU，空闲任务拿不到时间，删除任务的资源就会泄漏。",
        "vApplicationIdleHook 在空闲任务里被调用，适合做低功耗等待、喂狗或轻量统计，但绝对不能阻塞，也不能调用 vTaskDelay、xQueueReceive 这类可能让空闲任务挂起的函数。钩子里喂狗要小心：系统卡死时钩子不跑，看门狗才会复位。",
        "tickless 模式下，调度器算出下一个任务唤醒时刻，把 SysTick 重装载值设大并进睡眠，醒来后用 eTaskConfirmSleepModeStatus 判断能否补偿 tick。补偿期间所有延时和超时都按实际睡眠 tick 数修正，否则周期任务会整体漂移。"
      ],
      "visual": "states",
      "pitfalls": [
        "低功耗电流降不下来；原因是某个任务用 portMAX_DELAY 等队列，或空闲钩子里还有定时器在跑；查 eTaskConfirmSleepModeStatus 的返回值和 configEXPECTED_IDLE_TIME_BEFORE_SLEEP。"
      ],
      "qa": [
        {
          "q": "空闲任务能不能被删除或长期饿死？",
          "a": "不能删除，它是调度器基础设施的一部分；长期饿死虽然不一定立刻崩溃，但 vTaskDelete 删除的任务资源无法回收，还会让 tickless 和空闲钩子失效。应保证低优先级任务有运行机会，或改用静态分配减少回收依赖。"
        }
      ],
      "freq": 2,
      "analogy": "空闲任务像公司的保洁：大家都下班了才出来扫地（回收已删任务），谁也不能把保洁的活儿占满，否则垃圾越堆越多。",
      "example": "低功耗电流一直在 8 mA 下不去。查是空闲钩子里还在轮询标志，加上有任务用 portMAX_DELAY 等队列，tickless 进不去。删掉轮询后电流降到 200 微安。"
    },
    {
      "id": "rtos-09",
      "title": "队列为什么是拷贝：值传递、阻塞与唤醒",
      "tags": [
        "队列",
        "拷贝",
        "阻塞"
      ],
      "level": 1,
      "summary": "队列传的是数据本身不是地址，发完就能改原变量，两边不用管对方何时读。",
      "points": [
        "xQueueSend 把数据复制进队列存储区，不是传指针",
        "队列满时阻塞时间为 0 立即返回 errQUEUE_FULL",
        "portMAX_DELAY 表示无限等待，需要 INCLUDE_vTaskSuspend",
        "xQueueReceive 取出后复制到用户缓冲区并唤醒发送者"
      ],
      "detail": [
        "xQueueSend 的第三个参数是阻塞时间，单位 tick。队列满时，0 表示不等待立刻返回 errQUEUE_FULL，10 表示最多等 10 个 tick，portMAX_DELAY 表示一直等。发送成功后，若有任务在等这个队列，会把它从阻塞链表移到就绪链表。",
        "队列存储的是数据副本，发送方可以立刻复用原变量。传指针时要确保指向的内存在接收方处理完之前有效，常见错误是把栈上的局部数组地址发进队列，函数返回后队列里全是野指针。大块数据应传指针加引用计数或内存池块。",
        "xQueueReceive 同样按值拷贝，接收后队列空出一个位置，内核会唤醒等待发送的任务。中断里必须用 xQueueSendFromISR，并通过 xHigherPriorityTaskWoken 和 portYIELD_FROM_ISR 决定是否立刻切换，不能在 ISR 里调用带阻塞的版本。"
      ],
      "visual": "queue",
      "pitfalls": [
        "队列里读出来的结构体字段全乱；原因是发送了局部变量地址而不是值；改成 xQueueSend 传结构体本身，或把缓冲区声明为 static 并确保生命周期覆盖接收时刻。"
      ],
      "qa": [
        {
          "q": "xQueueSend 的阻塞时间设为 0 和 portMAX_DELAY 有什么区别？",
          "a": "0 表示队列满立刻返回失败，适合中断或不能等待的路径；portMAX_DELAY 表示一直等到有空位，任务进入阻塞态让出 CPU。用它要确认 INCLUDE_vTaskSuspend 为 1，且不能在临界区调用。"
        }
      ],
      "freq": 3,
      "analogy": "队列像取餐窗口的托盘：你把菜放上去（值拷贝），窗口自己保管，你转身就能洗锅；窗口满了厨师得等着，菜被取走才继续放。",
      "example": "xQueueSend 传了局部结构体地址，接收端读到的字段一直在变。队列是值拷贝，改成把结构体本身传进去；结构太大就传内存池块指针，并在注释里写清谁负责归还。"
    },
    {
      "id": "rtos-10",
      "title": "队列长度怎么定，队列集和邮箱怎么用",
      "tags": [
        "队列长度",
        "队列集",
        "邮箱"
      ],
      "level": 2,
      "summary": "队列长度按最坏突发算，短了丢数据，长了占内存还让端到端延迟变大。",
      "points": [
        "长度至少覆盖突发期间生产速率减消费速率",
        "长度过大增加 RAM 和延迟，过小会丢数据",
        "xQueueCreateSet 把多条队列加入集合统一等待",
        "邮箱用 xQueueCreate 长度 1，覆盖写要小心"
      ],
      "detail": [
        "队列长度先算最坏突发：生产者在 T 毫秒内发 N 条，消费者每 S 毫秒处理一条，长度至少为 N 减去 T 除以 S，再留 20% 余量。长度按元素个数算，每个元素还带链表项开销，RAM 紧张时要同时看队列存储区和控制块。",
        "队列集用 xQueueCreateSet 创建，xQueueAddToSet 把队列或信号量加入，xQueueSelectFromSet 返回就绪的句柄，适合一个任务等多个事件源。队列集本身有额外 RAM 和 CPU 开销，事件源少时直接轮询或用任务通知更简单。",
        "邮箱通常指长度为 1 的队列，xQueueOverwrite 可以覆盖旧值，适合只关心最新值的场景，例如传感器最新采样。覆盖写不会阻塞，但接收方可能永远看不到中间值；需要每条都处理时不能用覆盖语义。"
      ],
      "visual": "queue",
      "pitfalls": [
        "突发流量下队列频繁满；原因是长度只按平均速率算；查 errQUEUE_FULL 计数和队列高水位 uxQueueMessagesWaiting，按最坏突发重算长度或加流控。"
      ],
      "qa": [
        {
          "q": "队列长度设得越大越好吗？",
          "a": "不是。长度越大占用 RAM 越多，数据在队列里排队的时间也越长，端到端延迟变大；长度太小又会丢数据。应按最坏突发速率、消费者处理能力和可接受延迟三者折中，并用运行时统计验证。"
        }
      ],
      "freq": 2,
      "analogy": "队列像收银台前的排队栏杆：栏杆太短，人一多就挤出队外（丢数据）；栏杆太长，排在后面的人等到崩溃（延迟变大）。",
      "example": "串口突发一帧 200 字节，队列只开 8 项，errQUEUE_FULL 一小时出现几十次。按突发速率和解析耗时重算，长度改成 32，再用 uxQueueMessagesWaiting 看高水位只到 12，内存也没白占。"
    },
    {
      "id": "rtos-11",
      "title": "二值信号量与计数信号量：生产者消费者",
      "tags": [
        "信号量",
        "生产者消费者",
        "中断"
      ],
      "level": 1,
      "summary": "信号量就是一个计数器，用来告诉任务「有事件了」或者「还剩几个资源」。",
      "points": [
        "二值信号量最大计数 1，适合事件通知和同步",
        "计数信号量初值等于可用资源数，取不到就阻塞",
        "xSemaphoreTake 第二个参数是阻塞 tick 数",
        "中断释放后要处理 xHigherPriorityTaskWoken"
      ],
      "detail": [
        "二值信号量用 xSemaphoreCreateBinary 创建，初始为空，xSemaphoreGive 后变满，xSemaphoreTake 取走后变空。它适合中断通知任务：ISR 里 give，任务里 take，任务阻塞时不占 CPU，比轮询标志位省电且响应快。",
        "计数信号量用 xSemaphoreCreateCounting 创建，初值设为缓冲区空位数或资源数。生产者 give 增加计数，消费者 take 减少计数；计数到上限再 give 会失败，说明生产速度超过消费速度，应该反压或丢数据。",
        "xSemaphoreTake 的阻塞时间单位是 tick，0 表示立即返回，portMAX_DELAY 表示无限等待。ISR 里只能用 xSemaphoreGiveFromISR，它不会阻塞，并通过 xHigherPriorityTaskWoken 告诉移植层是否需要 portYIELD_FROM_ISR。"
      ],
      "visual": "queue",
      "pitfalls": [
        "中断里调用 xSemaphoreGive 导致断言或卡死；原因是普通 API 会操作阻塞链表；改成 xSemaphoreGiveFromISR，并在退出前调用 portYIELD_FROM_ISR。"
      ],
      "qa": [
        {
          "q": "二值信号量和计数信号量分别适合什么场景？",
          "a": "二值信号量只表示有或无，适合事件通知、中断到任务的同步；计数信号量表示可用资源数量，适合生产者消费者、缓冲区空位管理。需要记录次数或资源池时用计数型，只关心事件是否发生用二值型。"
        }
      ],
      "freq": 3,
      "analogy": "二值信号量像厕所门上的红绿牌，只表示有或没有；计数信号量像停车场剩余车位牌，进一辆减一出一辆加一，满了就拦着。",
      "example": "串口中断里直接调 xSemaphoreGive，跑一会儿就断言。中断里只能换成 xSemaphoreGiveFromISR，再把 xHigherPriorityTaskWoken 交给 portYIELD_FROM_ISR，改完没再死过。"
    },
    {
      "id": "rtos-12",
      "title": "互斥量：优先级继承如何缩短反转时间",
      "tags": [
        "互斥量",
        "优先级继承",
        "优先级反转"
      ],
      "level": 2,
      "summary": "互斥量给共享资源上锁，还会把持锁的低优先级任务临时提权，让你少等一会儿。",
      "points": [
        "xSemaphoreCreateMutex 创建，take 和 give 必须成对",
        "优先级继承只在持锁任务被更高优先级任务等待时生效",
        "互斥量不能在 ISR 中使用，也不能递归 take",
        "give 必须由持锁任务完成，不能跨任务释放"
      ],
      "detail": [
        "互斥量用 xSemaphoreCreateMutex 创建，初始可用。xSemaphoreTake 拿到锁后，任务优先级不变；当更高优先级任务也来 take 时，内核把持锁任务的优先级临时提升到等待者的优先级，让它尽快跑完临界区释放锁，这就是优先级继承。",
        "继承只在「高优先级任务阻塞在锁上」期间有效。持锁任务释放锁后，优先级恢复为 uxBasePriority；如果中间有多个等待者，会继承其中最高优先级。它不能消除反转，只能把反转时间限制在临界区长度内。",
        "互斥量内部会记录 xMutexHolder，释放时必须由持有者调用，否则返回失败。不能在 ISR 里 take 或 give，因为中断没有任务上下文，也无法参与优先级继承；中断与任务共享资源要用临界区或二值信号量加关中断。"
      ],
      "visual": "mutex",
      "pitfalls": [
        "高优先级任务偶尔超时；原因是低优先级任务持锁时被中优先级任务抢占；查持锁任务优先级是否被提升，缩短临界区，并确认没有在锁内调用 vTaskDelay 或 printf。"
      ],
      "qa": [
        {
          "q": "优先级继承能完全解决优先级反转吗？",
          "a": "不能。它只保证持锁的低优先级任务尽快执行，反转时间仍等于临界区执行时间；如果临界区里有阻塞调用，继承也救不了。正确做法是缩短临界区、避免锁内阻塞，并审查所有共享资源路径。"
        }
      ],
      "freq": 3,
      "analogy": "像会议室只有一把钥匙：谁拿到谁用；高优先级的人来要钥匙时，拿钥匙那位会被临时授予更高身份，赶紧开完会交出来。",
      "example": "高优先级控制任务偶尔超时 20 ms。查是它在等互斥量，持锁的低优先级任务被中优先级日志任务抢了 CPU。继承已开，但临界区里有一句 printf，把打印挪到锁外，超时就不见了。"
    },
    {
      "id": "rtos-13",
      "title": "优先级反转与死锁：现场怎么定位",
      "tags": [
        "优先级反转",
        "死锁",
        "实战"
      ],
      "level": 3,
      "summary": "反转是高优先级被中优先级间接堵住，死锁是两边互等对方的锁，谁都动不了。",
      "points": [
        "反转三任务模型：低持锁、中被唤醒、高等锁",
        "死锁四个条件里最容易破的是循环等待",
        "锁内调用阻塞 API 会把反转放大成永久卡死",
        "用 uxTaskGetSystemState 看谁在阻塞、谁持锁"
      ],
      "detail": [
        "经典反转是低优先级任务 L 持有互斥量，高优先级任务 H 阻塞在锁上，中优先级任务 M 就绪后抢占 L，导致 H 等 M 跑完。若 L 一直拿不到 CPU，H 的等待时间与 M 的执行时间成正比，表现为高优先级任务偶发超时。",
        "死锁常见于两个任务以相反顺序拿两把锁：任务 A 先拿锁 1 再等锁 2，任务 B 先拿锁 2 再等锁 1。破坏方法是全局规定锁顺序、用带超时的 xSemaphoreTake 并在失败时回滚，或把两把锁合并成一个粗粒度锁。",
        "定位时先抓每个任务的状态和阻塞对象，再看持锁者优先级是否被继承。若高优先级任务长期处于 Blocked 且持锁者也在 Blocked，基本就是锁内阻塞。用 GPIO 翻转或 SystemView 记录 take 和 give 的时间戳，比只看 printf 更准。"
      ],
      "visual": "mutex",
      "pitfalls": [
        "系统跑几小时后高优先级任务不再执行；原因是锁内调用了 xQueueReceive 且队列一直没数据；查阻塞对象和持锁者，把所有可能阻塞的调用移出临界区。"
      ],
      "qa": [
        {
          "q": "如何破坏死锁的循环等待条件？",
          "a": "给所有互斥量规定全局获取顺序，任何任务都按同一顺序加锁；或者用 trylock 加超时，拿不到第二把锁就释放第一把并重试。锁顺序是最简单可靠的办法，代码评审时要能画出锁的依赖图。"
        }
      ],
      "freq": 3,
      "analogy": "反转像三人挤一道窄门：矮个子拿钥匙慢慢走，中个子堵在门口，高个子只能在后面干等；死锁像两人各攥半把锁，互不相让。",
      "example": "系统跑两小时后高优先级任务不再执行。uxTaskGetSystemState 打出状态，看到它 Blocked 在锁上，持锁者 Blocked 在 xQueueReceive。队列接收挪出临界区，再规定两把锁的获取顺序，问题没再复现。"
    },
    {
      "id": "rtos-14",
      "title": "递归互斥量：同一任务重复拿锁",
      "tags": [
        "递归互斥量",
        "互斥量",
        "ISR"
      ],
      "level": 2,
      "summary": "递归互斥量允许同一个任务重复拿同一把锁，但拿了几次就得还几次。",
      "points": [
        "xSemaphoreCreateRecursiveMutex 创建递归锁",
        "xSemaphoreTakeRecursive 可重入，计数加一",
        "xSemaphoreGiveRecursive 必须匹配次数，否则锁不释放",
        "递归锁仍有持有者，ISR 中不能 take 或 give"
      ],
      "detail": [
        "普通互斥量被同一任务第二次 take 会阻塞自己，形成自死锁。递归互斥量用 xSemaphoreCreateRecursiveMutex 创建，内部记录持有者和递归计数，同一任务再次 take 只增加计数，不会阻塞。",
        "释放时必须调用相同次数的 xSemaphoreGiveRecursive，计数归零才真正释放并触发优先级继承恢复。少调用一次，锁永远不释放；多调用一次会触发断言。封装函数时要在所有返回路径上配对释放，包括错误分支。",
        "递归互斥量仍然属于任务上下文对象，ISR 里不能使用。中断与任务共享数据时，任务侧用 portENTER_CRITICAL 或互斥量，ISR 侧用 FromISR API 或关中断；不要让 ISR 去等一个可能被任务持有的锁。"
      ],
      "visual": "mutex",
      "pitfalls": [
        "递归锁 take 两次只 give 一次，其他任务永远等不到；原因是错误分支提前 return；查递归计数和持有者，用 cleanup 标签统一释放，或改用普通互斥量减少嵌套。"
      ],
      "qa": [
        {
          "q": "什么时候该用递归互斥量？",
          "a": "只在同一任务确实需要重复进入同一临界区时使用，例如递归函数或分层库回调。多数情况说明锁的粒度设计有问题，应把加锁上移到最外层，避免递归；递归锁计数不配对时更难排查。"
        }
      ],
      "freq": 2,
      "analogy": "像家里的门锁能反锁好几圈：你自己再拧一圈不会把自己关在外面，但出门前得一圈圈拧回来，少一圈门就没开。",
      "example": "封装了一个读配置函数，内部 take 一次，调用方外面又 take 一次，某天别的任务彻底等不到。查是错误分支 return 前少调一次 xSemaphoreGiveRecursive。改成出口统一释放，或干脆去掉外层加锁。"
    },
    {
      "id": "rtos-15",
      "title": "事件组：一次等多个事件",
      "tags": [
        "事件组",
        "位操作",
        "同步"
      ],
      "level": 2,
      "summary": "事件组用一个整数的每一位代表一个事件，任务可以一次等多个条件凑齐再往下走。",
      "points": [
        "xEventGroupSetBits 置位，ISR 用 SetBitsFromISR",
        "xEventGroupWaitBits 的 xClearOnExit 决定是否清位",
        "xWaitForAllBits 为 pdTRUE 时要求所有位都置位",
        "事件组不能传递数据，只表达状态"
      ],
      "detail": [
        "事件组用 EventBits_t 保存最多 24 个可用事件位，高 8 位被内核保留。任务用 xEventGroupSetBits 置位，用 xEventGroupWaitBits 等待；等待参数包括要等的位、是否全部满足、是否在退出时清除，以及阻塞时间。",
        "xEventGroupWaitBits 返回等待结束时的事件位值，可能包含不关心的位，调用者要用掩码判断。ISR 里用 xEventGroupSetBitsFromISR，它把置位操作发到定时器守护任务，因此不能在中断里无限等待，返回 pdFAIL 表示命令队列满。",
        "事件组适合「多个条件都满足才继续」的场景，例如网络连接加传感器就绪加用户启动。它不传递数据，也不计数，事件位被清除后无法知道发生过几次；需要计数时用计数信号量或任务通知。"
      ],
      "visual": null,
      "pitfalls": [
        "等待全部位时任务永远不醒；原因是某个事件位被 xClearOnExit 提前清掉，或 ISR 里用了普通 SetBits；查事件位掩码、清除语义和 FromISR 返回值。"
      ],
      "qa": [
        {
          "q": "xEventGroupWaitBits 的 xClearOnExit 有什么用？",
          "a": "它决定等待成功后是否自动清除所等待的位。置 pdTRUE 适合一次性事件，避免下次误判；置 pdFALSE 保留状态，适合多个任务观察同一组条件。清除是原子的，但只清除掩码内且已置位的位。"
        }
      ],
      "freq": 2,
      "analogy": "像登机前的检查清单：护照、登机牌、行李都打勾才能走；xWaitForAllBits 要求全部打勾，只看任一勾时就不用等齐。",
      "example": "任务要等联网、传感器就绪、按键启动三件事，用了三个信号量挨个 take，顺序一乱就死等。换成 xEventGroupWaitBits 等三个位，xWaitForAllBits 传 pdTRUE，退出不清位，逻辑清爽也不漏事件。"
    },
    {
      "id": "rtos-16",
      "title": "任务通知：最轻量的同步原语",
      "tags": [
        "任务通知",
        "性能",
        "同步"
      ],
      "level": 2,
      "summary": "任务通知直接改目标任务里的一个数，不用建对象，是最省资源的同步办法。",
      "points": [
        "xTaskNotifyGive 和 ulTaskNotifyTake 是最常用组合",
        "通知值 32 位，可当计数、位图或覆盖值",
        "只能一对一，不能广播，也不能给未创建的任务发",
        "ISR 中用 vTaskNotifyGiveFromISR"
      ],
      "detail": [
        "每个任务 TCB 里有一个 32 位通知值和一个通知状态。xTaskNotifyGive 把目标任务的计数加一，ulTaskNotifyTake 在任务侧等待并把计数清零或减一。它不需要额外分配队列结构，RAM 和 CPU 开销都比二值信号量小。",
        "xTaskNotify 可以设置覆盖、按位或、递增等动作，接收方用 xTaskNotifyWait 读取。它适合中断到任务的单点通知：ISR 里 vTaskNotifyGiveFromISR，任务里 ulTaskNotifyTake，省掉一个信号量对象和一次队列操作。",
        "限制是只能一对一：发送者必须知道目标任务句柄，无法像队列那样多对一或广播。若多个中断要通知同一个任务，可以用通知值按位或区分来源；若需要缓冲多条数据，还是用队列。"
      ],
      "visual": null,
      "pitfalls": [
        "任务通知偶尔丢事件；原因是发送方用了覆盖动作，后一个通知把前一个覆盖；查 eNotifyAction 是 eSetValueWithOverwrite 还是 eIncrement，需要计数就改用 give 语义。"
      ],
      "qa": [
        {
          "q": "任务通知为什么比二值信号量快？",
          "a": "二值信号量要维护队列控制块、存储区和等待链表，give 和 take 都要走队列路径；任务通知直接改目标任务 TCB 里的通知值，少一次对象查找和链表操作。单生产者单消费者场景优先用通知。"
        }
      ],
      "freq": 3,
      "analogy": "像直接给同事发一条微信：不用先去前台建个信箱（队列），点对点送到他手机上；但他只能一对一收，没法群发。",
      "example": "串口中断里用二值信号量通知任务，一字节一次，中断频率一高开销就明显。换成 vTaskNotifyGiveFromISR 配 ulTaskNotifyTake，省掉信号量对象，实测中断里少几十微秒，RAM 也降了。"
    },
    {
      "id": "rtos-17",
      "title": "软件定时器：守护任务与命令队列",
      "tags": [
        "软件定时器",
        "守护任务",
        "命令队列"
      ],
      "level": 2,
      "summary": "软件定时器就是让一个后台任务替你数时间，到点帮你调回调，你不用自己开硬件定时器。",
      "points": [
        "xTimerCreate 创建，xTimerStart 启动，周期可选",
        "回调在守护任务里执行，优先级由 configTIMER_TASK_PRIORITY 决定",
        "启动和停止命令进队列，队列满时返回 pdFAIL",
        "回调里不能调用阻塞 API，长耗时操作要投递到任务"
      ],
      "detail": [
        "软件定时器用 xTimerCreate 创建，参数包括名称、周期、是否自动重载、定时器 ID 和回调。xTimerStart 把启动命令发到定时器命令队列，守护任务按到期时间排序并调用回调。单次定时器到期后停止，周期定时器自动重装。",
        "守护任务的优先级和栈由 configTIMER_TASK_PRIORITY、configTIMER_TASK_STACK_DEPTH 配置。命令队列长度由 configTIMER_QUEUE_LENGTH 决定，队列满时 xTimerStart 返回 pdFAIL，不是阻塞等待，调用者必须检查返回值。",
        "回调运行在守护任务上下文，不能调用 vTaskDelay、xQueueReceive 等阻塞函数，否则整个定时器服务被拖住。耗时操作应该用任务通知或队列把工作交给专门任务，回调里只做置标志、发消息这类短动作。"
      ],
      "visual": null,
      "pitfalls": [
        "所有软件定时器突然一起延迟；原因是某个回调里做了耗时计算或阻塞调用；查守护任务栈高水位和回调执行时间，把重活移出回调。"
      ],
      "qa": [
        {
          "q": "软件定时器回调为什么不能阻塞？",
          "a": "回调由定时器守护任务串行执行，一旦阻塞，所有定时器的到期处理都被推迟，命令队列也会满。回调应只做短小的状态更新或发送通知，耗时逻辑交给普通任务，必要时用 xTimerPendFunctionCall 排队。"
        }
      ],
      "freq": 2,
      "analogy": "像公司前台：你写便签投进她的待办筐（命令队列），她按点挨个打电话（回调），筐满了你连便签都塞不进。",
      "example": "你用 xTimerCreate 建 100ms 周期定时器扫按键，回调里顺手加了 printf，另外三个定时器跟着一起晚；把打印挪进任务、回调只置标志，抖动从 6ms 降到 200us。"
    },
    {
      "id": "rtos-18",
      "title": "临界区与 BASEPRI：关中断关到哪一层",
      "tags": [
        "临界区",
        "BASEPRI",
        "中断优先级"
      ],
      "level": 2,
      "summary": "临界区是一小段「都别打断我」的代码，它只挡中低优先级中断，最高优先级照常能进。",
      "points": [
        "portENTER_CRITICAL 可嵌套，退出时恢复 BASEPRI",
        "BASEPRI 只屏蔽优先级数值不低于阈值的异常",
        "configMAX_SYSCALL_INTERRUPT_PRIORITY 是屏蔽阈值",
        "临界区越短越好，里面不能调用阻塞 API"
      ],
      "detail": [
        "Cortex-M 的 BASEPRI 寄存器写入一个优先级阈值，优先级数值大于等于该阈值的中断被屏蔽，数值更小的更高优先级中断仍然响应。FreeRTOS 把 configMAX_SYSCALL_INTERRUPT_PRIORITY 写进 BASEPRI，因此临界区不会屏蔽最高优先级的硬实时中断。",
        "portENTER_CRITICAL 和 portEXIT_CRITICAL 必须成对，内部用 uxCriticalNesting 计数支持嵌套。退出时只有最外层才恢复 BASEPRI，所以不能在临界区里 return 或 longjmp，否则嵌套计数失衡，后续中断被永久屏蔽。",
        "临界区里不能调用 xQueueSend、vTaskDelay 等可能阻塞的 API，也不能做耗时操作。共享变量访问通常几行代码就够；若临界区超过几十微秒，应重新设计，用互斥量或无锁结构替代。"
      ],
      "visual": "irq",
      "pitfalls": [
        "系统偶尔所有中断延迟变大；原因是临界区里有 printf 或 Flash 擦写；查 uxCriticalNesting 和临界区执行时间，用 GPIO 翻转测量并缩短到最小。"
      ],
      "qa": [
        {
          "q": "portENTER_CRITICAL 和 portDISABLE_INTERRUPTS 有什么区别？",
          "a": "portENTER_CRITICAL 用 BASEPRI 只屏蔽可管理中断，保留最高优先级中断，并支持嵌套；portDISABLE_INTERRUPTS 写 PRIMASK 关掉除 NMI 和 HardFault 外的中断，影响更大。"
        }
      ],
      "freq": 3,
      "analogy": "像门禁的等级线：你划一条线，级别低于这条线的人全挡外面，级别高的照走；关总闸才是连老板都锁门外。",
      "example": "你用 taskENTER_CRITICAL 包住 1KB Flash 擦写，关中断 8ms，串口开始丢字节；改成临界区里只更新一个 32 位计数，擦写交给任务，关中断降到 3us。"
    },
    {
      "id": "rtos-19",
      "title": "为什么 ISR 里只能用 FromISR 函数",
      "tags": [
        "ISR",
        "FromISR",
        "中断"
      ],
      "level": 2,
      "summary": "中断里没有任务可以挂起，所以只能用带 FromISR 的接口，塞不进就当场返回失败。",
      "points": [
        "FromISR 版本不阻塞，失败时立即返回 pdFALSE",
        "中断里不能调用 vTaskDelay 或带 portMAX_DELAY 的 take",
        "退出前用 portYIELD_FROM_ISR 决定是否切换",
        "xHigherPriorityTaskWoken 初始化为 pdFALSE"
      ],
      "detail": [
        "普通 xQueueSend 在队列满时会把当前任务挂到阻塞链表，但 ISR 不是任务，没有 TCB 可挂，调用会触发断言或破坏链表。FromISR 版本把阻塞时间固定为 0，队列满就返回 pdFALSE，不会让中断睡眠。",
        "xHigherPriorityTaskWoken 是一个输出参数，初始为 pdFALSE。ISR 里 give 或 send 唤醒更高优先级任务后，内核把它置 pdTRUE；退出中断前调用 portYIELD_FROM_ISR(xHigherPriorityTaskWoken)，让 PendSV 在中断返回后立即切换。",
        "不是所有 API 都有 FromISR 版本，像 vTaskDelay、xSemaphoreTake 的阻塞形式在 ISR 里绝对不能用。设计中断服务程序时要短：只清中断标志、读数据、发通知，复杂处理交给任务，中断延迟才可控。"
      ],
      "visual": "irq",
      "pitfalls": [
        "中断里调用 xQueueSend 后随机 HardFault；原因是队列满时试图阻塞 ISR；改成 xQueueSendFromISR 并检查返回值，队列满时计数丢弃而不是等待。"
      ],
      "qa": [
        {
          "q": "xHigherPriorityTaskWoken 为什么必须初始化？",
          "a": "它是输出参数，内核只在唤醒更高优先级任务时置 pdTRUE。若未初始化，portYIELD_FROM_ISR 可能读到随机值，导致不必要的中断返回切换，增加延迟甚至破坏现场。每次进入 ISR 都先设为 pdFALSE。"
        }
      ],
      "freq": 3,
      "analogy": "像消防员在火场：只能把手里的东西往传递窗一塞，塞不进就立刻退回，不能站那儿等别人腾地方。",
      "example": "串口中断里你写了 xQueueSend，波特率一高就 HardFault；换成 xQueueSendFromISR 并检查返回值，队列满就累加丢包计数，退出前调 portYIELD_FROM_ISR，再没崩过。"
    },
    {
      "id": "rtos-20",
      "title": "延迟中断：ISR 只做最少的事",
      "tags": [
        "延迟中断",
        "中断",
        "任务通知"
      ],
      "level": 2,
      "summary": "中断里只干最急的那一下，剩下的活扔给任务慢慢做，别的中断就不用排长队。",
      "points": [
        "ISR 越短，其他中断的响应越确定",
        "二值信号量适合事件通知，任务通知更轻量",
        "数据量大时用队列或 DMA 加半满中断",
        "延迟任务优先级要高于普通处理任务"
      ],
      "detail": [
        "延迟中断处理把 ISR 分成两段：上半段在中断里只做硬件相关的最小操作，例如读寄存器、清标志、把数据放入缓冲区；下半段在任务里做协议解析、计算和存储。这样高优先级中断不会被长时间挡住。",
        "交接方式有三种：二值信号量、任务通知、队列。单事件用任务通知最省；需要传数据用队列；数据量大用 DMA 传输完成中断，ISR 只 give 信号量。任务优先级要设得足够高，否则延迟处理会被其他任务拖长。",
        "测量时在 ISR 入口和任务处理入口各翻转一个 GPIO，用示波器看延迟；也可以用 SystemView 看中断和任务的时间线。若延迟超过截止时间，先检查是否有更高优先级任务长期占用 CPU，再检查临界区长度。"
      ],
      "visual": "irq",
      "pitfalls": [
        "串口接收偶发丢字节；原因是 ISR 里做了协议解析导致中断被长时间关闭；改成 ISR 只入队，解析放到任务，并检查队列长度和溢出计数。"
      ],
      "qa": [
        {
          "q": "延迟中断处理会不会增加响应延迟？",
          "a": "会增加任务级处理的延迟，但显著缩短中断关闭时间，提高整体可抢占性。硬实时部分仍放在 ISR 或最高优先级任务，非关键解析放低优先级任务。是否值得取决于截止时间和中断频率，要用测量数据判断。"
        }
      ],
      "freq": 3,
      "analogy": "像急诊分诊：护士只量血压贴标签，缝针拍片交给诊室，分诊台不堵，后来的病人也能马上被看到。",
      "example": "UART 中断里你解析整帧 Modbus，关中断 500us，编码器中断开始丢计数；改成 ISR 只把字节塞进队列，解析放任务，关中断降到 5us。"
    },
    {
      "id": "rtos-21",
      "title": "DMA 与 RTOS：完成中断、缓存与缓冲区管理",
      "tags": [
        "DMA",
        "缓存",
        "中断"
      ],
      "level": 3,
      "summary": "DMA 让外设自己搬数据，搬完才叫你，你在中断里放个信号量，任务接过去处理。",
      "points": [
        "DMA 完成中断里只清标志并 give 信号量",
        "发送缓冲区在 DMA 完成前不能被复用",
        "带 D-Cache 的芯片要做 clean 或 invalidate",
        "双缓冲和半满中断能降低延迟与丢包"
      ],
      "detail": [
        "串口或 SPI 的大块收发常用 DMA：任务配置 DMA 和缓冲区后阻塞在信号量上，DMA 完成中断里调用 xSemaphoreGiveFromISR，任务被唤醒后处理数据。这样 CPU 不用逐字节搬运，中断次数也大幅减少。",
        "发送方向要保证缓冲区在 DMA 完成前有效，常见错误是 xQueueSend 后立刻复用局部数组。接收方向若芯片有 D-Cache，DMA 写内存后 CPU 可能读到旧缓存，需要按 Cache 行做 invalidate；发送前要做 clean，否则 DMA 可能读到未落盘的数据。",
        "高吞吐场景用双缓冲或半满中断：DMA 填前半时任务处理后半，减少等待整帧的时间。缓冲区数量要和最坏处理时间匹配，队列满时丢帧并计数，不能无限 malloc，否则堆碎片会在长时间运行后暴露。"
      ],
      "visual": "dma",
      "pitfalls": [
        "DMA 收到的数据偶尔是旧值；原因是 D-Cache 未 invalidate 或缓冲区被提前复用；查 Cache 维护函数、DMA 完成标志和缓冲区所有权，用内存屏障确保顺序。"
      ],
      "qa": [
        {
          "q": "DMA 完成中断里能不能直接解析协议？",
          "a": "不建议。中断里解析会延长中断关闭时间，影响其他中断；正确做法是 give 信号量或发任务通知，让任务解析。若协议极短且截止时间很紧，也要测量中断执行时间，确保不超过系统可接受的上限。"
        }
      ],
      "freq": 1,
      "analogy": "像请搬家公司：你开门指路，他们自己搬，搬完按门铃，你再去清点；车没走之前别把箱子抽走。",
      "example": "SPI 收 2KB 数据，你用 HAL_SPI_Receive_DMA 加二值信号量，任务 take 等 100ms；忘了 SCB_InvalidateDCache_by_Addr，读出来全是旧值，加上就对了。"
    },
    {
      "id": "rtos-22",
      "title": "heap_1 到 heap_5：五种内存方案怎么选",
      "tags": [
        "内存管理",
        "heap",
        "configTOTAL_HEAP_SIZE"
      ],
      "level": 2,
      "summary": "FreeRTOS 有五种堆，就比谁能 free、空闲块合不合并，选错会碎片或分配失败。",
      "points": [
        "heap_1 最简单，适合任务创建后不再删除的系统",
        "heap_2 已不推荐，碎片问题明显",
        "heap_4 用首次适配加相邻块合并，最常用",
        "heap_5 在 heap_4 基础上支持多段不连续 RAM"
      ],
      "detail": [
        "heap_1 只实现 pvPortMalloc，不实现 vPortFree，分配指针一直递增，速度最快且无碎片，适合所有任务和队列在启动时创建、运行中不删除的系统。代价是无法回收，动态创建失败后只能重启。",
        "heap_2 支持释放，但空闲块不合并，长时间运行会产生外部碎片；新版本已不推荐。heap_3 把 malloc 和 free 包一层并关调度器，依赖编译器 C 库，堆大小由链接脚本决定，不是 configTOTAL_HEAP_SIZE。",
        "heap_4 用首次适配找空闲块，释放时合并相邻空闲块，抗碎片能力最好，是大多数项目的默认选择。heap_5 在 heap_4 基础上允许用 vPortDefineHeapRegions 注册多段不连续内存，例如内部 SRAM 加外部 SDRAM。",
        "选择原则：不删任务用 heap_1；需要动态释放优先 heap_4；多块 RAM 用 heap_5；要接 C 库或现有 malloc 用 heap_3。configTOTAL_HEAP_SIZE 要按峰值分配量加 20% 余量，并用 xPortGetMinimumEverFreeHeapSize 观察历史最低。"
      ],
      "visual": null,
      "pitfalls": [
        "运行几天后 pvPortMalloc 返回 NULL；原因是 heap_2 碎片或 heap_4 峰值不够；查 xPortGetFreeHeapSize 和 xPortGetMinimumEverFreeHeapSize，减少动态分配或换 heap_4。"
      ],
      "qa": [
        {
          "q": "heap_4 和 heap_2 的关键区别是什么？",
          "a": "heap_2 释放后不合并相邻空闲块，容易形成无法使用的小碎片；heap_4 在释放时合并相邻块，并按地址排序插入空闲链表，能显著延缓碎片化。新项目需要动态释放时应直接选 heap_4，而不是 heap_2。"
        }
      ],
      "freq": 3,
      "analogy": "像五种停车场：heap_1 只进不出，heap_2 能出但不并车位，heap_4 会把相邻空位拼成大位，heap_5 还能管马路对面那块地。",
      "example": "设备跑三天后 pvPortMalloc 返回 NULL，可 xPortGetFreeHeapSize 还剩 5KB；原来用 heap_2，换 heap_4 再盯 xPortGetMinimumEverFreeHeapSize，就没再出过。"
    },
    {
      "id": "rtos-23",
      "title": "内存碎片：外部碎片怎么发现和缓解",
      "tags": [
        "内存碎片",
        "heap_4",
        "内存池"
      ],
      "level": 3,
      "summary": "碎片就是空地方不少，但全是小缝，你要的大块塞不进去，于是分配失败。",
      "points": [
        "频繁分配释放不同大小块最容易产生碎片",
        "xPortGetMinimumEverFreeHeapSize 看历史最低",
        "固定大小块用内存池或队列预分配",
        "启动阶段一次性分配，运行期只复用"
      ],
      "detail": [
        "外部碎片指空闲内存总量足够，但被分割成许多不连续小块，申请较大块时失败。频繁 malloc 和 free 不同大小的结构、队列项大小不一、任务反复创建删除，都会加速碎片化。heap_4 的合并能缓解，但不能彻底消除。",
        "观察手段是 xPortGetFreeHeapSize 和 xPortGetMinimumEverFreeHeapSize 的差值，以及分配失败计数。若空闲总量还有几 KB 但 pvPortMalloc 返回 NULL，基本就是碎片。此时打印空闲块链表，能看到大量小于请求值的块。",
        "工程上更可靠的是预分配：启动时创建所有任务、队列和缓冲区，运行期只复用不释放；大小固定的对象用内存池或 FreeRTOS 队列存储区；变长数据用固定上限的块池。若必须动态分配，尽量按相同大小申请。"
      ],
      "visual": null,
      "pitfalls": [
        "空闲堆还有 4 KB 却分配 256 字节失败；原因是碎片化导致没有连续块；查空闲块大小分布，改用固定块内存池，或把大分配移到启动阶段。"
      ],
      "qa": [
        {
          "q": "为什么嵌入式项目不建议频繁 malloc 和 free？",
          "a": "通用堆分配时间不确定，长期运行会产生外部碎片，最终出现总量够但分配失败；还可能引发锁竞争和内存泄漏。更稳妥的是启动时静态或一次性分配，运行期用内存池和队列复用固定块。"
        }
      ],
      "freq": 2,
      "analogy": "像书架抽走几本薄书：空出来的位置加起来够放一本厚词典，可没有一个格子塞得下，你只能干瞪眼。",
      "example": "设备跑一周后申请 256 字节失败，xPortGetFreeHeapSize 还显示 4KB；打空闲块发现有 30 多个 40 字节小洞，改成启动时建固定块内存池就好了。"
    },
    {
      "id": "rtos-24",
      "title": "tick 中断、tickless 与低功耗",
      "tags": [
        "tick",
        "tickless",
        "低功耗"
      ],
      "level": 3,
      "summary": "tick 是系统的心跳，跳一下时间加一格；tickless 是没人干活时先把心跳停了省电。",
      "points": [
        "configTICK_RATE_HZ 1000 表示 1 tick 等于 1 ms",
        "tick 越高调度粒度越细，但中断开销越大",
        "tickless 需要移植层支持，睡眠前后补偿 tick",
        "唤醒源要能区分正常唤醒和异常唤醒"
      ],
      "detail": [
        "SysTick 以 configTICK_RATE_HZ 的频率中断，每次 xTaskIncrementTick 更新 tick 计数、检查延时链表和超时。1000 Hz 下时间片和延时精度都是 1 ms；提高到 10 kHz 会明显增加中断开销，降低效率。",
        "tickless 空闲时计算下一个任务唤醒时刻，把 SysTick 重装载值设成更长的睡眠时间，然后执行 WFI 或 WFE。醒来后调用 vTaskStepTick 补偿实际睡过的 tick，否则所有延时和超时都会少算，周期任务逐渐漂移。",
        "低功耗设计还要处理外设唤醒：UART 收到首字节、DMA 完成、RTC 闹钟都能唤醒 CPU。若唤醒源不是 tick，补偿逻辑仍要正确；调试时先关 tickless 验证功能，再打开并测量电流和唤醒延迟。"
      ],
      "visual": "irq",
      "pitfalls": [
        "打开 tickless 后串口偶发丢包；原因是睡眠期间外设时钟被关或唤醒延迟超过字节间隔；查低功耗模式下 UART 时钟和唤醒源，必要时用 DMA 加空闲中断。"
      ],
      "qa": [
        {
          "q": "tickless 模式下 vTaskDelay 的精度会变差吗？",
          "a": "不会变差，但依赖补偿是否正确。睡眠期间不产生 tick，唤醒后内核按实际睡眠时间补 tick，延时到期时刻仍按原基准计算。若补偿漏掉或睡眠被意外中断，延时就会提前或延后，需要测量验证。"
        }
      ],
      "freq": 2,
      "analogy": "像老式打卡钟：白天每分钟响一次，你按响声算时间；夜里没人来就把钟停了，早上开机再把停掉的几小时补记回去。",
      "example": "configTICK_RATE_HZ 设 1000，vTaskDelay(10) 正好 10ms；改 tickless 后移植层漏了 vTaskStepTick 补偿，周期任务每天慢 40 秒。"
    },
    {
      "id": "rtos-25",
      "title": "CPU 利用率和运行时统计怎么做",
      "tags": [
        "CPU利用率",
        "运行时统计",
        "调试"
      ],
      "level": 3,
      "summary": "CPU 利用率就是这段时间 CPU 忙了多少，空闲任务占多少，你就还剩多少余量。",
      "points": [
        "configGENERATE_RUN_TIME_STATS 打开运行时统计",
        "需要一个高精度计时器，通常是定时器通道",
        "vTaskGetRunTimeStats 输出任务名、绝对时间和百分比",
        "空闲任务占比就是剩余 CPU 余量"
      ],
      "detail": [
        "CPU 利用率可用空闲任务占比估算：空闲钩子累加计数，再用总时间减。更精确的是打开 configGENERATE_RUN_TIME_STATS，配置 portCONFIGURE_TIMER_FOR_RUN_TIME_STATS 和一个 10 到 20 倍 tick 频率的计时器。",
        "vTaskGetRunTimeStats 会遍历所有任务，输出每个任务的运行时间和百分比，缓冲区要足够大。它本身有开销，不要在高频控制环里调用；采样间隔至少几秒，才能看出趋势。百分比高不一定是问题，关键看是否超过预算。",
        "分析时结合 uxTaskGetSystemState：它返回任务状态、优先级、栈高水位和运行计数，适合做运行时监控页面。若空闲任务占比低于 10%，说明系统接近满载，任何突发都会导致超时；此时应优化热点或提高主频。"
      ],
      "visual": "sched",
      "pitfalls": [
        "运行时统计百分比加起来不是 100；原因是统计定时器频率不够或采样窗口太短；提高计时器分辨率，延长采样时间，并排除统计自身的开销。"
      ],
      "qa": [
        {
          "q": "没有额外定时器时怎么估算 CPU 利用率？",
          "a": "可以在空闲钩子里对一个 volatile 计数累加，再用固定窗口内的空闲计数除以理论上限，得到粗略占用率。精度受钩子调用频率和编译器优化影响，适合趋势观察；要精确定位任务占比还是需要运行时统计定时器。"
        }
      ],
      "freq": 2,
      "analogy": "像看店员一天忙不忙：空闲任务就是站着发呆的时间，发呆越少越接近忙不过来，再来一波客人就得排队。",
      "example": "打开 configGENERATE_RUN_TIME_STATS，拿 TIM2 做 20 倍 tick 的计时器，vTaskGetRunTimeStats 打出空闲只剩 6%，一加滤波就超时，砍掉浮点后回到 30%。"
    },
    {
      "id": "rtos-26",
      "title": "软件看门狗在 RTOS 里怎么设计",
      "tags": [
        "看门狗",
        "可靠性",
        "任务监控"
      ],
      "level": 3,
      "summary": "看门狗是颗倒计时炸弹，你得让每个关键任务都来报个到，人齐了才准拆弹。",
      "points": [
        "硬件看门狗超时时间要覆盖最坏任务周期",
        "每个关键任务在周期内置位自己的心跳位",
        "监控任务检查所有位齐全后才喂狗",
        "喂狗任务优先级不宜最高，避免掩盖卡死"
      ],
      "detail": [
        "直接在空闲钩子里喂狗是常见错误：某个高优先级任务死循环时，空闲任务不运行，看门狗反而复位，看起来像随机重启；更糟的是中断里喂狗，主循环卡死也能喂。正确做法是让每个关键任务定期上报心跳。",
        "实现上用一个事件组或位图，每个任务在周期内 set 自己的位，监控任务按最长周期检查，所有位齐全才喂硬件看门狗并清位。某个任务超时未上报，监控任务记录任务名和栈信息后主动复位，便于定位。",
        "看门狗超时时间要大于最坏情况下的任务周期之和，又不能太长导致故障恢复慢。调试阶段可以先只记录不复位，量产再打开。若用独立看门狗，注意低功耗模式下时钟是否继续计数。"
      ],
      "visual": null,
      "pitfalls": [
        "设备在现场随机重启；原因是看门狗在中断里喂，主任务卡死仍能喂狗；改成任务心跳加监控任务，并保存复位原因和最后心跳位到备份寄存器。"
      ],
      "qa": [
        {
          "q": "为什么不能在中断里喂看门狗？",
          "a": "中断可能仍在运行而主任务已经死锁，中断喂狗会掩盖故障，看门狗失去意义。喂狗应该由监控任务在确认所有关键任务心跳正常后执行，这样任务级卡死才能触发复位。"
        }
      ],
      "freq": 2,
      "analogy": "像工地班长点名：每个工人隔一会儿举一次手，班长数齐了才去销假，少一个就拉闸停工，谁都别想蒙混。",
      "example": "你在空闲钩子里喂狗，电机任务死循环后机器照转；改成三个任务置事件组位，监控任务用 xEventGroupWaitBits 等齐 0x07 再喂，卡死 2 秒就复位。"
    },
    {
      "id": "rtos-27",
      "title": "任务划分与优先级分配原则",
      "tags": [
        "任务划分",
        "优先级",
        "架构"
      ],
      "level": 2,
      "summary": "按事件源拆任务，按截止时间定优先级：急的给高的，慢的给低的，别一个任务全包。",
      "points": [
        "按数据流和事件源划分，避免一个任务包办所有事",
        "硬实时、软实时、后台任务分三档优先级",
        "任务栈和周期要可测，避免隐藏的长时间计算",
        "共享资源少用全局变量，多用队列传递"
      ],
      "detail": [
        "任务划分优先按事件源：每个外设或每个独立数据流一个任务，例如电机控制、串口协议、显示刷新。不要按函数层次划分，否则任务间同步复杂。一个任务内部可以用状态机处理多个相关事件，减少上下文切换。",
        "优先级按截止时间分配：硬实时控制环最高，通信协议次之，日志和界面最低。相同优先级只在任务性质相近时使用。优先级数量控制在 5 到 8 档，太多会导致继承和调试复杂，configMAX_PRIORITIES 也不必开很大。",
        "每个任务要有明确的周期、最坏执行时间和栈预算，并用运行时统计验证。共享数据尽量用队列或任务通知传递所有权，少用全局变量加关中断。任务之间避免环形等待，锁的顺序要统一。"
      ],
      "visual": "sched",
      "pitfalls": [
        "系统任务越加越多，切换开销大且时序混乱；原因是按功能而不是按事件源划分；合并同源任务，用状态机处理分支，并重新评估优先级和栈。"
      ],
      "qa": [
        {
          "q": "一个任务里能不能同时处理串口接收和电机控制？",
          "a": "不推荐。电机控制是硬实时，串口解析可能耗时且不可预测，放在同一任务会拉长控制周期。应拆成两个任务，用队列或通知传递数据，让电机控制任务保持短小并拥有更高优先级。"
        }
      ],
      "freq": 3,
      "analogy": "像开小馆子：一个灶台配一个厨子，凉菜出得快先做，煲汤和收银慢慢来，别让一个厨子又炒菜又收钱。",
      "example": "你把串口解析和电机 PID 塞进一个任务，PID 周期从 1ms 抖到 4ms；拆成两个任务，电机优先级 6、串口 3，用队列传目标值，抖动回到 1.05ms。"
    },
    {
      "id": "rtos-28",
      "title": "RTOS 还是裸机状态机：怎么取舍",
      "tags": [
        "RTOS",
        "裸机",
        "架构选型"
      ],
      "level": 2,
      "summary": "任务少、时序简单、RAM 又紧就用裸机状态机；要多任务并发、要抢占才上 RTOS。",
      "points": [
        "裸机没有上下文切换和内核 ROM 开销",
        "RTOS 擅长处理多个并发阻塞和优先级",
        "RAM 小于几 KB 的 MCU 要谨慎评估",
        "混合方案：中断加主循环加少量任务"
      ],
      "detail": [
        "裸机前后台系统用主循环加中断，代码小、时序直观、没有内核开销，适合任务少于三四个、逻辑能用状态机表达的场景。缺点是任何阻塞都会拖住整个系统，复杂协议和多个外设并发时状态机容易膨胀。",
        "RTOS 的价值在于把并发阻塞变成任务阻塞，让高优先级任务及时抢占，代码按任务线性编写，可读性更好。代价是每个任务要独立栈、内核占 Flash 和 RAM、需要处理优先级反转和栈溢出等新问题。",
        "选型看三点：是否有硬实时截止时间、是否有多个独立事件源、RAM 是否足够。8 位 MCU 只有 2 KB RAM 时，RTOS 的栈和内核结构可能吃不消；Cortex-M0 加 20 KB RAM 跑 FreeRTOS 则很常见。也可以只在小范围用 RTOS。"
      ],
      "visual": "states",
      "pitfalls": [
        "小 RAM MCU 上跑 RTOS 后频繁 HardFault；原因是任务栈加堆超过可用 RAM；查 map 文件的 RAM 占用、configTOTAL_HEAP_SIZE 和每个任务栈，必要时退回裸机或减任务。"
      ],
      "qa": [
        {
          "q": "什么时候不应该用 RTOS？",
          "a": "任务极少、逻辑可用一个状态机清楚表达、RAM 非常紧张、团队不熟悉并发调试时，不必引入 RTOS。裸机系统更小更可预测；但若出现多个阻塞点相互拖累、截止时间难保证，就应考虑 RTOS。"
        }
      ],
      "freq": 2,
      "analogy": "像一个人看店对雇一个团队：一个人啥都能干，可一忙就全停；团队能并行，但得发工资、租工位，占地方。",
      "example": "2KB RAM 的 8 位机上你硬塞 FreeRTOS，两个任务栈加堆直接吃满，一跑就 HardFault；退回裸机主循环加定时器状态机，RAM 只用 1.1KB。"
    },
    {
      "id": "rtos-29",
      "title": "ESP32 的 FreeRTOS：双核与任务看门狗",
      "tags": [
        "ESP32",
        "双核",
        "任务看门狗"
      ],
      "level": 3,
      "summary": "ESP32 有两个核，任务能钉在指定核上跑，还有任务看门狗盯着谁长期霸着 CPU 不让。",
      "points": [
        "xTaskCreatePinnedToCore 的最后一个参数指定核心",
        "双核共享内存，临界区要使用自旋锁",
        "任务看门狗 TWDT 监控任务是否饿死",
        "ESP-IDF 的定时器和中断语义与裸 FreeRTOS 有差异"
      ],
      "detail": [
        "ESP32 的 FreeRTOS 是双核对称多处理变体，xTaskCreatePinnedToCore 可以把任务绑定到 core 0 或 core 1，最后一个参数是核心号。不绑定则由调度器分配，任务可能在两个核之间迁移，缓存局部性变差。",
        "双核同时访问共享数据时，单核的关中断不够，需要用 portMUX_TYPE 自旋锁或临界区宏。中断也可能在另一个核触发，ISR 里同样只能用 FromISR API，并通过 xHigherPriorityTaskWoken 触发调度。",
        "ESP-IDF 默认启用任务看门狗，空闲任务和用户任务要定期调用 vTaskDelay 或喂 TWDT，否则会打印任务名和调用栈并复位。长时间计算的循环要主动让出 CPU 或喂狗，但喂狗不能掩盖真正的死循环。"
      ],
      "visual": null,
      "pitfalls": [
        "ESP32 上任务莫名重启并打印任务看门狗超时；原因是高优先级任务长时间忙等不让出 CPU；查 TWDT 日志里的任务名和 PC，加入 vTaskDelay 或拆分计算。"
      ],
      "qa": [
        {
          "q": "ESP32 双核下为什么不能只靠 taskENTER_CRITICAL 保护共享数据？",
          "a": "taskENTER_CRITICAL 只关当前核的中断，另一个核仍可能同时访问共享变量。双核共享资源要用自旋锁 portMUX_TYPE，或使用原子操作和消息传递，确保两个核之间也互斥。"
        }
      ],
      "freq": 2,
      "analogy": "像两个前台各管一队：你能指定客人排哪队，可两人共用一个登记本，谁动手都得先拿锁，不然账就写乱了。",
      "example": "你把采集任务用 xTaskCreatePinnedToCore 钉在 core 1，一个 while 循环忘了 vTaskDelay，TWDT 打印任务名后复位；循环里加 vTaskDelay(1) 就好了。"
    },
    {
      "id": "rtos-30",
      "title": "RTOS 常见 HardFault 归因与定位",
      "tags": [
        "HardFault",
        "栈溢出",
        "调试"
      ],
      "level": 3,
      "summary": "RTOS 里进 HardFault，多半是栈溢出踩坏内存、野指针，或者中断里用错 API。",
      "points": [
        "先看 SCB 的 CFSR、HFSR 和 BFAR 定位故障类型",
        "栈溢出常踩坏 TCB 或返回地址，表现为随机 PC",
        "中断优先级分组和 BASEPRI 配置错误会进 HardFault",
        "在 HardFault 里打印 PSP、LR 和栈回溯"
      ],
      "detail": [
        "进入 HardFault 先读 SCB 的 CFSR、HFSR、MMFAR 和 BFAR，判断是非法访问、总线错误还是未定义指令。若 CFSR 的 INVSTATE 置位，常见原因是函数指针低位为 0，跳转时 Thumb 位丢失；若 BFAR 有效，能直接看到出错地址。",
        "RTOS 里栈溢出是高频原因：任务栈越界踩坏相邻 TCB 的链表指针或返回地址，切换时才崩，现场看起来毫无规律。打开 configCHECK_FOR_STACK_OVERFLOW 为 2，在钩子里记录 pxCurrentTCB 和任务名，再结合 map 文件看栈边界。",
        "中断优先级数值配置错误也会触发 HardFault，例如把 FreeRTOS 可管理中断设得比 configMAX_SYSCALL_INTERRUPT_PRIORITY 更高却调用了 FromISR API。NVIC 的优先级分组要统一，所有调用 FreeRTOS API 的中断优先级数值必须不小于阈值。"
      ],
      "visual": "irq",
      "pitfalls": [
        "HardFault 的 PC 每次都不一样；原因是某任务栈溢出踩坏了其他任务；查 CFSR、栈高水位和溢出钩子，用 MPU 或栈填充定位越界任务。"
      ],
      "qa": [
        {
          "q": "HardFault 里怎么判断是不是栈溢出？",
          "a": "看 CFSR 是否有非法访问或总线错误，检查出错地址是否落在某个任务栈边界附近；再打开栈溢出钩子和高水位统计。若多个任务的 TCB 字段被改写、PC 随机跳变，基本可以确定是栈溢出。"
        }
      ],
      "freq": 3,
      "analogy": "像一排连着的储物柜：有人东西塞太满，挤出自己柜子，把隔壁柜门顶坏；坏的是隔壁，你查半天找不到人。",
      "example": "HardFault 的 PC 每次都不一样，读 CFSR 是 IMPRECISERR；把 configCHECK_FOR_STACK_OVERFLOW 设 2，钩子抓到显示任务只剩 12 字栈，栈加大到 1024 字节就稳了。"
    },
    {
      "id": "rtos-31",
      "title": "运行时调试：uxTaskGetSystemState、Tracealyzer 与 SystemView",
      "tags": [
        "调试",
        "Tracealyzer",
        "SystemView"
      ],
      "level": 3,
      "summary": "想知道谁在堵、谁快把栈用完，就抓一份任务快照或一段时间线，别靠猜。",
      "points": [
        "uxTaskGetSystemState 一次拿到状态、优先级和栈高水位",
        "Tracealyzer 需要移植记录钩子，可视化任务和中断",
        "SystemView 用 SEGGER RTT 传输，开销较低",
        "先抓时间线再改代码，避免凭感觉盲猜",
        "调试前先确认 tskKERNEL_VERSION_NUMBER 与移植层一致"
      ],
      "detail": [
        "uxTaskGetSystemState 填充 TaskStatus_t 数组，包含任务名、任务号、当前状态、优先级、栈高水位和运行计数。它适合做串口命令或调试页面，周期性打印即可发现哪个任务长期阻塞、哪个栈快用完。",
        "Tracealyzer 通过 FreeRTOS 的 trace 钩子记录任务切换、队列、信号量和中断事件，在 PC 上画时间线。它能直观看到优先级反转、队列堆积和中断延迟；代价是额外的 RAM 和 CPU 开销，通常只在调试版固件启用。",
        "SystemView 使用 SEGGER RTT 传输事件，对目标影响较小，适合长时间抓取。配置时要打开 configUSE_TRACE_FACILITY 和相应的记录宏。无论用哪种工具，先抓一段真实负载的时间线，再针对性优化。"
      ],
      "visual": null,
      "pitfalls": [
        "Tracealyzer 一开就影响实时性；原因是记录缓冲区太小或事件太多导致频繁刷新；增大缓冲区、只记录关键事件，或在正式版关闭追踪。"
      ],
      "qa": [
        {
          "q": "线上设备不能接调试器，怎么排查任务问题？",
          "a": "保留一个低优先级诊断任务，周期性调用 uxTaskGetSystemState 和 vTaskGetRunTimeStats，把结果写入环形日志或通过串口输出；同时记录复位原因、栈高水位和队列溢出计数。这样不打断实时性，也能回溯。"
        }
      ],
      "freq": 1,
      "analogy": "像查堵车：快照是拍张照片看哪条道排满，时间线是行车记录仪，能看清谁先堵、谁在后面干等。",
      "example": "现场偶发 200ms 卡顿，你用 SystemView 抓 10 秒时间线，看到日志任务持互斥量 180ms，控制任务干等；把日志改成队列异步写，卡顿没了。"
    },
    {
      "id": "rtos-32",
      "title": "高频 API 误用与面试速查",
      "tags": [
        "API",
        "面试",
        "踩坑"
      ],
      "level": 2,
      "summary": "四个坑最常见：中断里用阻塞 API、超时当毫秒写、锁拿了不还、队列里塞大结构体。",
      "points": [
        "ISR 里只能用带 FromISR 后缀的 API",
        "超时参数单位是 tick，不是毫秒",
        "互斥量 take 和 give 必须同任务配对",
        "队列发送大结构体要评估拷贝开销"
      ],
      "detail": [
        "ISR 里调用 xQueueSend、xSemaphoreTake、vTaskDelay 都会出问题，因为中断没有任务上下文，不能阻塞。正确做法是使用 FromISR 版本，检查返回值，并在退出前调用 portYIELD_FROM_ISR。",
        "超时参数统一是 tick：configTICK_RATE_HZ 为 1000 时，10 才是 10 ms，直接写 10 毫秒在 100 Hz 配置下会变成 100 ms。portMAX_DELAY 表示无限等待，但要求 INCLUDE_vTaskSuspend 为 1。",
        "互斥量必须由持有者释放，递归锁要配对次数；队列发送结构体会整块拷贝，大结构体应传指针或内存池块。所有返回值都要检查，尤其是创建失败和队列满，否则问题会推迟到现场才暴露。"
      ],
      "visual": null,
      "pitfalls": [
        "移植后所有延时都变长十倍；原因是 configTICK_RATE_HZ 从 1000 改成 100，代码里仍把毫秒当 tick；统一用 pdMS_TO_TICKS 宏转换，并检查所有超时参数。"
      ],
      "qa": [
        {
          "q": "FreeRTOS 项目上线前你会检查哪些配置？",
          "a": "查 configTICK_RATE_HZ、configMAX_PRIORITIES、configUSE_PREEMPTION、堆方案和 configTOTAL_HEAP_SIZE；确认栈溢出检测与看门狗已开，并核对 FromISR 用法。"
        }
      ],
      "freq": 2,
      "analogy": "像借工具：在不能等的场合排队等，把 10 分钟说成 10 秒，扳手借了不还，下一个来干活的人只能干等。",
      "example": "移植后延时全变长十倍，因为 configTICK_RATE_HZ 从 1000 改成 100，代码里还写 vTaskDelay(10) 当 10ms；全换成 pdMS_TO_TICKS(10) 就对了。"
    }
  ]
};
