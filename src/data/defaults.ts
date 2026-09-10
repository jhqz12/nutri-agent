import type { AppState, BodyLog, Exercise, FoodItem, Recipe, ScheduleItem } from '../types'

export const defaultSchedule: ScheduleItem[] = [
  { id: 'schedule-wake', title: '起床、温水与补剂', time: '08:30', durationMinutes: 20, category: '补剂', reminderMinutes: 0, notes: '补剂只按已确认剂量记录，不临时加量。', completed: false },
  { id: 'schedule-work', title: '开始工作', time: '09:00', durationMinutes: 180, category: '工作', reminderMinutes: 5, notes: '每60分钟起身活动2至3分钟。', completed: false },
  { id: 'schedule-lunch', title: '午餐', time: '12:00', durationMinutes: 30, category: '饮食', reminderMinutes: 10, notes: '先选蛋白质和蔬菜，再确定主食份量。', completed: false },
  { id: 'schedule-nap', title: '午睡', time: '12:30', durationMinutes: 30, category: '睡眠', reminderMinutes: 0, notes: '', completed: false },
  { id: 'schedule-bike', title: '单车有氧', time: '19:30', durationMinutes: 30, category: '训练', reminderMinutes: 10, notes: '腿日若明显疲劳，可缩短至10至15分钟或移到力量训练后。', completed: false },
  { id: 'schedule-strength', title: '三分化力量训练', time: '20:00', durationMinutes: 60, category: '训练', reminderMinutes: 10, notes: '任何麻木、电击感或突然无力都立即停止当前动作。', completed: false },
  { id: 'schedule-sleep', title: '准备睡觉', time: '23:45', durationMinutes: 525, category: '睡眠', reminderMinutes: 30, notes: '目标睡眠8小时以上。', completed: false }
]

export const defaultFoods: FoodItem[] = [
  { id: 'food-egg', name: '白煮蛋', unit: '份', calories: 75, protein: 6.5, fat: 5.2, carbs: 0.6, source: '常用估算值，可编辑' },
  { id: 'food-rice', name: '熟米饭100克', unit: 'g', calories: 116, protein: 2.6, fat: 0.3, carbs: 25.9, source: '常用估算值，可编辑' },
  { id: 'food-chicken', name: '去皮鸡腿肉100克', unit: 'g', calories: 177, protein: 24, fat: 8, carbs: 0, source: '常用估算值，可编辑' },
  { id: 'food-tuna', name: '水浸金枪鱼100克', unit: 'g', calories: 116, protein: 25.5, fat: 0.8, carbs: 0, source: '常用估算值，可编辑' },
  { id: 'food-beef', name: '瘦牛肉100克', unit: 'g', calories: 190, protein: 26, fat: 9, carbs: 0, source: '常用估算值，可编辑' }
]

export const defaultRecipes: Recipe[] = [
  { id: 'recipe-eggs', name: '白煮蛋加蛋汤', category: '早餐', ingredients: '白煮蛋2个、清蛋汤1碗', servingLabel: '1份', calories: 230, protein: 19, fat: 14, carbs: 7, price: '低', source: '个人常用餐估算' },
  { id: 'recipe-eggs-milk', name: '白煮蛋加无糖牛奶', category: '早餐', ingredients: '白煮蛋2个、无糖牛奶300毫升', servingLabel: '1份', calories: 330, protein: 25, fat: 19, carbs: 15, price: '低', source: '常用食材估算' },
  { id: 'recipe-canteen-chicken', name: '食堂鸡肉蔬菜饭', category: '午餐', ingredients: '米饭200克、鸡肉180克、蔬菜300克', servingLabel: '1份', calories: 720, protein: 55, fat: 22, carbs: 76, price: '中', source: '食堂组合估算' },
  { id: 'recipe-canteen-beef', name: '食堂牛肉蔬菜饭', category: '午餐', ingredients: '米饭180克、瘦牛肉160克、蔬菜300克', servingLabel: '1份', calories: 760, protein: 48, fat: 28, carbs: 78, price: '中', source: '食堂组合估算' },
  { id: 'recipe-canteen-fish', name: '食堂鱼肉豆腐饭', category: '午餐', ingredients: '米饭180克、鱼肉180克、豆腐100克、蔬菜', servingLabel: '1份', calories: 690, protein: 52, fat: 20, carbs: 73, price: '中', source: '食堂组合估算' },
  { id: 'recipe-tuna-rice', name: '金枪鱼拌饭加鸡腿肉', category: '晚餐', ingredients: '金枪鱼拌饭1份、去皮鸡腿肉1份', servingLabel: '1份', calories: 930, protein: 66, fat: 30, carbs: 96, price: '中', source: '连锁餐饮估算，按门店实物修正' },
  { id: 'recipe-tuna-beef', name: '金枪鱼拌饭加牛肉', category: '晚餐', ingredients: '金枪鱼拌饭1份、牛肉1份', servingLabel: '1份', calories: 980, protein: 63, fat: 35, carbs: 98, price: '中', source: '连锁餐饮估算，按门店实物修正' },
  { id: 'recipe-burger', name: '双蛋牛肉堡', category: '晚餐', ingredients: '双蛋牛肉堡1份，不含糖饮料', servingLabel: '1份', calories: 780, protein: 45, fat: 40, carbs: 58, price: '中', source: '外食估算，建议补录官方营养表' },
  { id: 'recipe-protein', name: '蛋白粉加香蕉', category: '日间加餐', ingredients: '蛋白粉1勺、香蕉1根', servingLabel: '1份', calories: 230, protein: 22, fat: 2, carbs: 33, price: '低', source: '包装营养表与常用估算' },
  { id: 'recipe-yogurt', name: '无糖酸奶加燕麦', category: '日间加餐', ingredients: '无糖酸奶250克、燕麦40克', servingLabel: '1份', calories: 330, protein: 19, fat: 9, carbs: 43, price: '低', source: '常用食材估算' },
  { id: 'recipe-squid', name: '米饭加鱿鱼蔬菜', category: '晚餐', ingredients: '米饭200克、鱿鱼200克、蔬菜250克', servingLabel: '1份', calories: 650, protein: 48, fat: 14, carbs: 78, price: '中', source: '外食组合估算' },
  { id: 'recipe-fruit', name: '水果坚果加餐', category: '日间加餐', ingredients: '苹果1个、原味坚果20克', servingLabel: '1份', calories: 240, protein: 5, fat: 12, carbs: 31, price: '低', source: '常用食材估算' }
]

type ExerciseSeed = Pick<Exercise, 'id' | 'name' | 'targetArea' | 'steps'> & Partial<Omit<Exercise, 'id' | 'name' | 'targetArea' | 'steps'>>

const makeExercise = (seed: ExerciseSeed): Exercise => ({
  sets: 2,
  minReps: 10,
  maxReps: 12,
  weightKg: 0,
  incrementKg: 2.5,
  targetRir: 3,
  restSeconds: 90,
  commonErrors: '为了完成次数而耸肩、反弓腰、憋气或甩动重量。',
  alternative: '使用更轻重量、缩小幅度，或改用有胸背支撑的同类动作。',
  stopCriteria: '出现手指麻木、电击感、突然无力、疼痛达到3分或腰背牵拉扩散时停止。',
  enabled: true,
  mediaUrl: '',
  ...seed
})

export const defaultPushExercises: Exercise[] = [
  makeExercise({
    id: 'push-warm-foam-chest', name: '泡沫轴胸部扩张', targetArea: '胸廓呼吸与胸肌放松（热身）',
    sets: 1, minReps: 6, maxReps: 8, targetRir: 5, restSeconds: 45,
    steps: '俯卧让泡沫轴轻压胸肌外侧，缓慢吸气把胸廓撑开，再小幅滚动；压力只到舒服，不压锁骨、腋窝或神经敏感处。',
    commonErrors: '憋气硬压、直接滚骨头、为了更深而把肩膀顶向前。',
    alternative: '门框胸肌动态伸展，或仰卧屈膝呼吸。'
  }),
  makeExercise({
    id: 'push-warm-serratus-wall', name: '前锯肌墙推泡沫轴', targetArea: '前锯肌与肩胛上旋（热身）',
    sets: 2, minReps: 8, maxReps: 10, targetRir: 4, restSeconds: 45,
    steps: '小臂轻压泡沫轴，先把肩胛贴住胸廓，再在不耸肩的范围内向上滑；肋骨保持收住。',
    commonErrors: '耸肩、顶腰、手臂滑得过高后肩胛失控。',
    alternative: '墙面肩胛俯卧撑或墙面滑臂。'
  }),
  makeExercise({
    id: 'push-warm-abdominal-stretch', name: '站姿腹肌动态伸展', targetArea: '胸廓活动（备用热身）',
    sets: 1, minReps: 6, maxReps: 8, targetRir: 5, restSeconds: 45, enabled: false,
    steps: '双手扶髋，先收臀和收肋，再做很小幅度的胸椎后伸；不要把动作集中压到腰椎。',
    commonErrors: '大幅后仰、顶腰、憋气，或把腰椎挤压感当成拉伸。',
    alternative: '侧卧开书或泡沫轴胸椎伸展。',
    stopCriteria: '右下背不适上升、腰椎挤压痛或后仰弹响伴疼痛时停止。'
  }),
  makeExercise({
    id: 'push-warm-band-circle', name: '弹力带绕肩', targetArea: '肩关节活动与肩胛控制（热身）',
    sets: 2, minReps: 12, maxReps: 15, targetRir: 4, restSeconds: 45,
    steps: '弹力带保持轻张力，只在无痛范围内绕肩；收住肋骨，肩膀不耸起。',
    commonErrors: '握距太窄、强行跨过卡点、顶腰或追求大幅度。',
    alternative: '毛巾辅助绕肩或墙面滑臂。'
  }),
  makeExercise({
    id: 'push-incline-machine-fly', name: '上斜固定器械夹胸', targetArea: '上胸',
    sets: 2, minReps: 10, maxReps: 12, targetRir: 4, restSeconds: 90,
    steps: '座椅调到把手与上胸齐平，肩胛贴稳靠背；只用无痛范围夹合，顶端短暂停顿。',
    commonErrors: '肩膀前顶、耸肩、下放过深或用手臂猛夹。',
    alternative: '低重量绳索夹胸或高位俯卧撑。'
  }),
  makeExercise({
    id: 'push-incline-dumbbell-press', name: '上斜哑铃卧推', targetArea: '上胸（症状消失后再启用）',
    sets: 2, minReps: 8, maxReps: 10, targetRir: 4, restSeconds: 150, enabled: false,
    steps: '凳角20～30度，全握或自然半对握，手腕笔直、肘与躯干约30～45度；腰部保留自然小空隙，不大幅反弓。',
    commonErrors: '手腕内扣、肘接近90度外开、锁定时耸肩、憋气并用右下背顶起。',
    alternative: '高位俯卧撑、上斜器械推胸或5～7.5公斤哑铃重建。',
    stopCriteria: '左手无名指或小拇指麻木、左斜方代偿、右下背牵拉扩散或手腕失控时立即停止。'
  }),
  makeExercise({
    id: 'push-incline-machine-press', name: '上斜器械推胸', targetArea: '上胸（备用）',
    sets: 2, minReps: 10, maxReps: 12, targetRir: 4, restSeconds: 120, enabled: false,
    steps: '优先选择20～30度靠背，前臂与推力方向一致；肘不过度抬高，推到不耸肩的位置就停止。',
    commonErrors: '把肘抬到接近肩高、腰部反弓、锁肘耸肩或使用半握导致手腕失控。',
    alternative: '坐姿器械平推或高位俯卧撑。'
  }),
  makeExercise({
    id: 'push-seated-machine-press', name: '坐姿器械平推', targetArea: '中胸',
    sets: 3, minReps: 8, maxReps: 12, targetRir: 3, restSeconds: 120,
    steps: '全握把手，脚踩稳，肩胛贴住靠背；推起时缓慢呼气，顶部不耸肩、不强锁肘。',
    commonErrors: '半握、手腕折弯、挺腰顶肋、肩膀离开靠背。',
    alternative: '高位俯卧撑或低重量哑铃卧推。'
  }),
  makeExercise({
    id: 'push-cable-mid-fly', name: '龙门架中位夹胸', targetArea: '中胸与左右控制',
    sets: 2, minReps: 12, maxReps: 15, targetRir: 3, restSeconds: 75,
    steps: '滑轮与中胸大致同高，肘保持轻微弯曲；胸廓稳定，双臂画弧靠近，不需要手柄相撞。',
    commonErrors: '把肘完全锁死、耸肩、身体前后摇摆或用手腕夹。',
    alternative: '单臂绳索夹胸或器械夹胸。'
  }),
  makeExercise({
    id: 'push-dip', name: '双杠臂屈伸', targetArea: '下胸（当前暂停）',
    sets: 2, minReps: 6, maxReps: 10, targetRir: 5, restSeconds: 150, enabled: false,
    steps: '只有在完全无手麻时才从辅助双杠开始；肩膀不耸、肘部不出现电击感，下降到肩前无压力的位置。',
    commonErrors: '直接用自重硬撑、下降过深、推起时肘麻、锁定时耸肩。',
    alternative: '辅助双杠、高位俯卧撑或绳索下压。',
    stopCriteria: '左肘跳麻筋、无名指或小拇指麻木、握力下降时立即停止，当前不建议启用。'
  }),
  makeExercise({
    id: 'push-cable-low-fly', name: '龙门架下胸夹胸', targetArea: '下胸',
    sets: 2, minReps: 12, maxReps: 15, targetRir: 3, restSeconds: 75,
    steps: '滑轮放在略高于肩的位置，身体轻微前倾，手臂向前下方画弧；保持肋骨和骨盆稳定。',
    commonErrors: '用腰部前后摆动、耸肩、手臂完全锁死或下拉到大腿根造成肩前压力。',
    alternative: '下斜俯卧撑或器械平推。'
  }),
  makeExercise({
    id: 'push-cable-front-raise', name: '绳索前平举', targetArea: '三角肌前束（备用）',
    sets: 2, minReps: 12, maxReps: 15, targetRir: 4, restSeconds: 75, enabled: false,
    steps: '轻重量从身前抬到肩高以下，肋骨收住，肩胛自然上旋。',
    commonErrors: '用腰甩起、耸肩、抬得过高或手腕折弯。',
    alternative: '地雷管推举或低角度上斜推。'
  })
]

export const defaultPullExercises: Exercise[] = [
  makeExercise({
    id: 'pull-warm-wall-roll', name: '泡沫轴靠墙推', targetArea: '前锯肌与中下斜方肌（热身）',
    sets: 2, minReps: 8, maxReps: 10, targetRir: 4, restSeconds: 45,
    steps: '小臂轻压泡沫轴，肩胛贴住胸廓后小幅向上推；掌心自然相对，肋骨不外翻。',
    commonErrors: '耸肩、探头、顶腰或为了幅度让肩胛失去控制。',
    alternative: '墙面滑臂或墙面肩胛俯卧撑。'
  }),
  makeExercise({
    id: 'pull-warm-kneeling-elbow', name: '跪姿肘屈伸', targetArea: '肩胛控制（热身）',
    sets: 1, minReps: 8, maxReps: 10, targetRir: 5, restSeconds: 45,
    steps: '手肘垫在凳面，掌心相对，重心轻轻向后；肩胛保持贴胸，只做小幅肘屈伸。',
    commonErrors: '肘部直接压在硬边、幅度过大、肩膀耸起或出现尺神经麻感仍继续。',
    alternative: '墙面滑臂加前伸。',
    stopCriteria: '左肘电击感、无名指或小拇指麻木时立即停止。'
  }),
  makeExercise({
    id: 'pull-warm-overhead-triceps', name: '坐姿颈后臂屈伸', targetArea: '肩胛控制（当前备用）',
    sets: 1, minReps: 8, maxReps: 10, targetRir: 5, restSeconds: 45, enabled: false,
    steps: '仅用极轻负荷，手腕中立，大臂保持在无痛位置；不追求深度。',
    commonErrors: '肘部过度弯曲、手腕塌陷、肩膀前顶或神经麻木仍继续。',
    alternative: '墙面滑臂或弹力带直臂下压。',
    stopCriteria: '任何左肘麻筋跳动或手指麻木时停止，当前不建议启用。'
  }),
  makeExercise({
    id: 'pull-warm-ab-wheel', name: '跪姿泡沫轴前推', targetArea: '肩胛与核心稳定（备用）',
    sets: 1, minReps: 6, maxReps: 8, targetRir: 5, restSeconds: 60, enabled: false,
    steps: '膝盖支撑，小臂放在泡沫轴上，小幅前推；收住肋骨和骨盆，动作只到腰背保持稳定的位置。',
    commonErrors: '把健腹轮推得过远、塌腰、憋气或用右下背拉回。',
    alternative: '死虫式或墙面前锯肌前伸。',
    stopCriteria: '右下背牵拉、腰椎下沉或肩肘麻木时停止。'
  }),
  makeExercise({
    id: 'pull-supinated-pulldown', name: '反手窄距高位下拉', targetArea: '下背阔肌（备用）',
    sets: 2, minReps: 10, maxReps: 12, targetRir: 4, restSeconds: 120, enabled: false,
    steps: '全握或舒适握法，握距约肩宽；肘向身体两侧下拉，躯干不后仰。',
    commonErrors: '半握、手腕过度后伸、肘部夹得过紧、耸肩或身体后甩。',
    alternative: '对握高位下拉。',
    stopCriteria: '左肘麻筋、手指麻木或握力突然下降时停止。'
  }),
  makeExercise({
    id: 'pull-neutral-pulldown', name: '对握高位下拉', targetArea: '背阔肌与全背',
    sets: 3, minReps: 8, maxReps: 12, targetRir: 3, restSeconds: 120,
    steps: '全握对握把手，脚和大腿垫固定身体；肘向下靠近躯干，拉到肩膀不前顶的位置。',
    commonErrors: '后仰借力、耸肩、含胸、把手拉得过低或回放时完全失控。',
    alternative: '弹力带跪姿下拉或辅助引体向上。'
  }),
  makeExercise({
    id: 'pull-wide-pulldown', name: '宽距正手高位下拉', targetArea: '上背与背阔肌上部（备用）',
    sets: 2, minReps: 10, maxReps: 12, targetRir: 4, restSeconds: 120, enabled: false,
    steps: '握距只比肩略宽，拉到锁骨前方；在肩部舒适范围内完成，不追求超宽握距。',
    commonErrors: '握得过宽、拉到颈后、身体后仰或肩前夹痛。',
    alternative: '对握高位下拉。'
  }),
  makeExercise({
    id: 'pull-close-row', name: '窄距对握坐姿划船', targetArea: '背阔肌中下部',
    sets: 3, minReps: 8, maxReps: 12, targetRir: 3, restSeconds: 120,
    steps: '脚踩稳，骨盆和胸廓保持中立；肘向后下方划，手柄到下胸或上腹附近，停顿后控制还原。',
    commonErrors: '顶腰、后仰、耸肩、用腿蹬动身体或回放时含胸塌腰。',
    alternative: '胸托划船或弹力带坐姿划船。'
  }),
  makeExercise({
    id: 'pull-single-cable-row', name: '单臂绳索划船', targetArea: '单侧背阔肌与抗旋转',
    sets: 2, minReps: 10, maxReps: 12, targetRir: 3, restSeconds: 90,
    steps: '滑轮约与下胸齐平，同侧脚在前；骨盆正对前方，肘向后下方划，躯干不旋转。',
    commonErrors: '身体侧屈旋转、肩膀前顶、手臂单独拉或右下背代偿。',
    alternative: '单臂胸托哑铃划船。'
  }),
  makeExercise({
    id: 'pull-overhand-row', name: '正手坐姿划船', targetArea: '中背厚度（备用）',
    sets: 2, minReps: 10, maxReps: 12, targetRir: 4, restSeconds: 120, enabled: false,
    steps: '握距比肩略宽，胸廓保持稳定；肘向后下方移动，顶端不夹到腰椎反弓。',
    commonErrors: '顶腰、后仰、耸肩或为了肩胛后缩过度挺胸。',
    alternative: '胸托正手划船。'
  }),
  makeExercise({
    id: 'pull-tbar-row', name: 'T杆划船', targetArea: '上背厚度（当前备用）',
    sets: 2, minReps: 8, maxReps: 12, targetRir: 4, restSeconds: 150, enabled: false,
    steps: '优先使用胸托T杆；膝盖微屈、脊柱中立，肘向后打开，动作到肩胛稳定收紧即可。',
    commonErrors: '无胸托时长时间俯身、反弓腰、用髋部弹起重量或右下背持续绷紧。',
    alternative: '胸托器械划船或俯卧哑铃划船。',
    stopCriteria: '右下背不适出现、扩散或训练后持续升高时停止。'
  }),
  makeExercise({
    id: 'pull-reverse-fly', name: '龙门架反向飞鸟', targetArea: '三角肌后束与中背',
    sets: 2, minReps: 12, maxReps: 15, targetRir: 3, restSeconds: 75,
    steps: '胸口贴住直角凳，肋骨收住；轻重量向两侧打开，肩膀远离耳朵，缓慢还原。',
    commonErrors: '耸肩、顶肋、用腰反弓或把动作做成大重量划船。',
    alternative: '反向蝴蝶机或弹力带拉开。'
  }),
  makeExercise({
    id: 'pull-dumbbell-pullover', name: '仰卧哑铃上提', targetArea: '背阔肌与大圆肌（备用）',
    sets: 2, minReps: 10, maxReps: 12, targetRir: 4, restSeconds: 90, enabled: false,
    steps: '使用轻哑铃，肘保持微屈；下放到肩关节舒适位置，收住肋骨，不用腰部扩大幅度。',
    commonErrors: '下放过深、肋骨外翻、腰部反弓、手腕或肘部不稳。',
    alternative: '绳索直臂下压。'
  }),
  makeExercise({
    id: 'pull-skull-crusher', name: '仰卧杠铃臂屈伸', targetArea: '肱三头肌（当前暂停）',
    sets: 2, minReps: 10, maxReps: 12, targetRir: 5, restSeconds: 120, enabled: false,
    steps: '只有在肘部完全无麻木时才用轻重量尝试，手腕中立，肘不向外散开。',
    commonErrors: '大重量、手腕塌陷、肘部过度屈曲、出现麻筋仍继续。',
    alternative: '绳索下压或轻弹力带下压。',
    stopCriteria: '左肘电击感、无名指或小拇指麻木、握力下降时立即停止，当前不建议启用。'
  })
]

export const defaultLegExercises: Exercise[] = [
  {
    id: 'leg-warm-frog-rock',
    name: '青蛙趴前后移动',
    targetArea: '髋内侧活动度（热身）',
    sets: 2,
    minReps: 8,
    maxReps: 10,
    weightKg: 0,
    incrementKg: 0.5,
    targetRir: 4,
    restSeconds: 45,
    steps: '肘部支撑，膝盖在舒服范围内打开，屁股缓慢向后坐；只做到髋内侧有轻微拉伸，不追求压得更低。',
    commonErrors: '塌腰、憋气、膝盖被硬压向外，或用疼痛换取幅度。',
    alternative: '仰卧屈膝左右轻摆，或扶墙侧向重心移动。',
    stopCriteria: '腹股沟夹痛、膝痛、右下背不适升高到3分或动作后继续加重时停止。'
  },
  {
    id: 'leg-warm-frog-rotation',
    name: '青蛙趴髋内旋',
    targetArea: '髋深层旋转控制（热身）',
    sets: 1,
    minReps: 8,
    maxReps: 10,
    weightKg: 0,
    incrementKg: 0.5,
    targetRir: 4,
    restSeconds: 45,
    steps: '保持青蛙趴位置，收住腹部，小腿在无痛范围内缓慢向外移动，让髋关节产生内旋；左右同步、幅度宁小勿大。',
    commonErrors: '靠腰部扭转代替髋旋转，快速甩腿，或为了对称强压受限侧。',
    alternative: '仰卧90度屈髋，双脚分开、膝盖轻柔向内移动。',
    stopCriteria: '出现髋前夹痛、膝内侧不适、腰部扭转感或不适达到3分时停止。'
  },
  {
    id: 'leg-warm-worlds-greatest',
    name: '伟大者伸展',
    targetArea: '髋前侧与胸椎旋转（热身）',
    sets: 1,
    minReps: 8,
    maxReps: 10,
    weightKg: 0,
    incrementKg: 0.5,
    targetRir: 4,
    restSeconds: 45,
    steps: '前脚踩稳，后腿向后伸；同侧手支撑，另一只手缓慢向上打开。骨盆保持稳定，每侧完成相同次数。',
    commonErrors: '前膝向内扣、腰椎过度扭转、耸肩，或为了摸地而弓背。',
    alternative: '手扶高凳完成同样动作，减少髋部和腰背压力。',
    stopCriteria: '腿部麻木、髋前夹痛、膝痛或右下背牵拉扩散时停止。'
  },
  {
    id: 'leg-warm-seated-hip-extension',
    name: '坐姿顶髋后伸腿',
    targetArea: '髋前侧活动度（热身）',
    sets: 1,
    minReps: 8,
    maxReps: 10,
    weightKg: 0,
    incrementKg: 0.5,
    targetRir: 4,
    restSeconds: 45,
    steps: '坐姿一腿伸直、一腿屈曲，双手可撑地；收住腹部后轻轻向前顶髋，只做到髋前侧有温和拉伸，每侧完成。',
    commonErrors: '挺腰代替伸髋、憋气、动作过快，或把拉伸做成髋前夹痛。',
    alternative: '半跪髋屈肌动态伸展，扶墙保持平衡。',
    stopCriteria: '右下背代偿明显、髋前夹痛或不适达到3分时停止。'
  },
  {
    id: 'leg-calf-raise',
    name: '站姿提踵',
    targetArea: '小腿与脚踝稳定',
    sets: 2,
    minReps: 15,
    maxReps: 20,
    weightKg: 0,
    incrementKg: 2.5,
    targetRir: 3,
    restSeconds: 60,
    steps: '前脚掌踩稳，脚跟缓慢下降后向上提；扶住固定物保持平衡，脚踝沿第二脚趾方向运动。原文为4～6组，当前先做2组。',
    commonErrors: '用脚趾抓地借力、脚踝向外翻、上下弹震，或身体前后晃动。',
    alternative: '平地双脚提踵；稳定后可改为单腿提踵或器械提踵。',
    stopCriteria: '足底、跟腱或膝部锐痛，抽筋无法缓解，或动作明显失控时停止。'
  },
  {
    id: 'leg-adduction',
    name: '坐姿腿内收',
    targetArea: '大腿内侧与骨盆控制',
    sets: 2,
    minReps: 15,
    maxReps: 20,
    weightKg: 0,
    incrementKg: 2.5,
    targetRir: 3,
    restSeconds: 75,
    steps: '座椅调到骨盆能保持中立的位置，双脚放松；缓慢合拢双腿，停顿一下再控制打开。原文为4～6组，当前先做2组。',
    commonErrors: '用身体前倾甩动重量、憋气夹腿、骨盆向一侧歪，或追求过大打开幅度。',
    alternative: '仰卧夹枕头等长用力，或弹力带站姿内收。',
    stopCriteria: '腹股沟刺痛、盆底坠胀、腰臀不适上升或左右明显失控时停止。'
  },
  {
    id: 'leg-bulgarian-split-squat',
    name: '保加利亚分腿蹲',
    targetArea: '单腿稳定、臀腿与髋伸',
    sets: 2,
    minReps: 8,
    maxReps: 12,
    weightKg: 0,
    incrementKg: 1,
    targetRir: 4,
    restSeconds: 120,
    steps: '后脚轻放在凳上，前脚承担主要力量；骨盆朝正前方，前膝跟随脚尖方向。先用自重，每侧8～12次。',
    commonErrors: '让后脚主导发力、前膝内扣、骨盆旋转、腰部大幅反弓，或下蹲过深后失去平衡。',
    alternative: '扶墙分腿蹲、低台阶上台阶，或静态分腿蹲。',
    stopCriteria: '膝痛达到3分、髋前夹痛、右下背牵拉扩散、麻木或突然无力时停止。'
  },
  {
    id: 'leg-dumbbell-rdl',
    name: '哑铃罗马尼亚硬拉',
    targetArea: '臀部、大腿后侧与髋铰链',
    sets: 2,
    minReps: 10,
    maxReps: 12,
    weightKg: 0,
    incrementKg: 2,
    targetRir: 4,
    restSeconds: 120,
    steps: '双脚用自然角度站立，膝盖微屈，屁股向后移动；哑铃贴近腿下降，到能保持脊柱中立的位置就返回，不强求到小腿中段。',
    commonErrors: '强行脚尖内扣、弯腰够低、哑铃离身体太远、膝盖不断前移，或起身时过度挺腰。',
    alternative: '徒手靠墙髋铰链、短幅度哑铃硬拉，或拉力器拉胯。',
    stopCriteria: '右下背牵拉扩散、腿部放射不适、麻木、电击感或动作必须靠憋气反弓完成时停止。'
  },
  {
    id: 'leg-extension',
    name: '坐姿腿屈伸',
    targetArea: '股四头肌与膝关节控制',
    sets: 3,
    minReps: 12,
    maxReps: 15,
    weightKg: 0,
    incrementKg: 2.5,
    targetRir: 3,
    restSeconds: 90,
    steps: '膝关节轴对准器械转轴，小腿垫放在脚踝上方；用自然脚尖方向抬起，顶端不过度甩直，下降2秒。',
    commonErrors: '强行脚尖内扣、用惯性踢起、臀部离开座椅，或为追重量缩短控制过程。',
    alternative: '靠墙静蹲、低台阶下台阶，或弹力带终末伸膝。',
    stopCriteria: '膝前锐痛、关节卡住、单侧明显无力或疼痛达到3分时停止。'
  },
  {
    id: 'leg-prone-curl',
    name: '俯身腿弯举',
    targetArea: '大腿后侧与膝屈控制',
    sets: 2,
    minReps: 12,
    maxReps: 15,
    weightKg: 0,
    incrementKg: 2.5,
    targetRir: 3,
    restSeconds: 90,
    steps: '腹部轻轻收紧，骨盆贴稳垫面；脚尖保持自然方向，弯曲膝盖后控制下降，到骨盆不会翘起的位置即可。',
    commonErrors: '强行脚内旋、撅屁股、腰部反弓、快速砸下重量，或左右腿不同步。',
    alternative: '仰卧脚跟滑动、健身球腿弯举，或弹力带站姿腿弯举。',
    stopCriteria: '后膝疼痛、腿部抽筋持续、右下背代偿、麻木或突然无力时停止。'
  }
]

// 首次使用不预置任何身体记录，由用户在「趋势」页自行添加，避免默认暴露真实身体数据。
const defaultBodyLogs: BodyLog[] = []

export const defaultState: AppState = {
  dataVersion: 7,
  trainingTemplate: '三分化',
  trainingFrequency: '连续循环',
  trainingCycleStartedAt: new Date().toISOString().slice(0, 10),
  trainingCycleAnchor: {
    date: new Date().toISOString().slice(0, 10),
    planId: 'plan-push',
    isRestDay: false
  },
  profile: {
    name: '我的计划', sex: 'male', age: 0, heightCm: 0, weightKg: 0, bodyFatPercent: null, targetWeightKg: 0,
    activityFactor: 1.55, trainingCalories: 0, restCalories: 0, proteinGrams: 0,
    trainingFatGrams: 0, restFatGrams: 0
  },
  schedule: defaultSchedule,
  planDays: [
    { id: 'plan-push', name: '推', exercises: defaultPushExercises },
    { id: 'plan-pull', name: '拉', exercises: defaultPullExercises },
    { id: 'plan-legs', name: '腿', exercises: defaultLegExercises }
  ],
  sessions: [], foods: defaultFoods, recipes: defaultRecipes, meals: [], bodyLogs: defaultBodyLogs, coachMessages: [],
  supplements: [
    { id: 'supp-fish-oil', name: '鱼油', dose: '按现有标签剂量', time: '08:30', enabled: true },
    { id: 'supp-creatine', name: '肌酸', dose: '5克', time: '12:00', enabled: true },
    { id: 'supp-d3', name: '维生素D3', dose: '按化验与医生建议', time: '12:00', enabled: true },
    { id: 'supp-magnesium', name: '镁', dose: '按标签剂量', time: '23:00', enabled: true }
  ],
  mealCount: 3, isTrainingDay: true, lastUpdatedAt: new Date().toISOString()
}
