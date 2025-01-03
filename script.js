class Calendar {
    constructor() {
        this.currentDate = new Date();
        this.today = new Date();
        this.selectedRegions = new Set(['all']);
        this.currentPopup = null;
        // 初始化空的事件对象
        this.events = {
            holidays: {
                'thailand': [],
                'malaysia': [],
                'indonesia': [],
                'philippines': []
            },
            seasonal: []
        };
        this.supabase = window.supabase;
        this.init();
        this.initEventForm();
    }

    async init() {
        // 从数据库加载事件
        await this.loadEvents();
        this.renderCalendar();
        this.renderFutureEvents();
        this.attachEventListeners();
    }

    async loadEvents() {
        try {
            // 初始化空的事件对象
            this.events = {
                holidays: {
                    'thailand': [],
                    'malaysia': [],
                    'indonesia': [],
                    'philippines': []
                },
                seasonal: []
            };

            // 只从数据库加载节日数据
            const { data: holidays, error: holidaysError } = await this.supabase
                .from('holidays')
                .select('*');
            
            if (holidaysError) throw holidaysError;

            // 按地区组织节日数据
            if (holidays) {
                holidays.forEach(holiday => {
                    if (!this.events.holidays[holiday.region]) {
                        this.events.holidays[holiday.region] = [];
                    }
                    this.events.holidays[holiday.region].push(holiday);
                });
            }

            // 只从数据库加载季节性活动数据
            const { data: seasonal, error: seasonalError } = await this.supabase
                .from('seasonal_events')
                .select('*');
            
            if (seasonalError) throw seasonalError;

            this.events.seasonal = seasonal || [];

            this.renderCalendar();
        } catch (error) {
            console.error('加载事件错误:', error);
            alert('加载事件失败: ' + error.message);
        }
    }

    async addEvent(newEvent, eventType) {
        try {
            const table = eventType === 'holiday' ? 'holidays' : 'seasonal_events';
            
            // 准备基本数据
            const baseData = {
                id: crypto.randomUUID(),
                date: newEvent.date,
                name: newEvent.name === '宋干节' ? '泰国宋干节' : newEvent.name,
                description: newEvent.description || '',
                category: newEvent.category || (eventType === 'holiday' ? '节日' : '季节性活动'),
                region: newEvent.region,
                products: newEvent.products || {},
                history_products: newEvent.history_products || {}
            };

            // 根据事件类型添加额外字段
            const eventData = eventType === 'seasonal' 
                ? { ...baseData, duration: newEvent.duration || 1 }
                : baseData;

            const { data, error } = await this.supabase
                .from(table)
                .insert([eventData])
                .select();

            if (error) {
                console.error('添加事件错误:', error);
                throw error;
            }

            // 更新本地数据
            if (data && data.length > 0) {
                if (eventType === 'holiday') {
                    if (!this.events.holidays[eventData.region]) {
                        this.events.holidays[eventData.region] = [];
                    }
                    this.events.holidays[eventData.region].push(data[0]);
                } else {
                    this.events.seasonal.push(data[0]);
                }

                this.renderCalendar();
                return true;
            }
            return false;
        } catch (error) {
            console.error('添加事件错误:', error);
            alert('添加事件失败: ' + error.message);
            return false;
        }
    }

    async deleteEvent(event) {
        const deleteButton = document.querySelector('.delete-event');
        const confirmPrompt = document.createElement('div');
        confirmPrompt.className = 'delete-confirm';
        confirmPrompt.innerHTML = `
            <span>确定删除？</span>
            <button class="confirm-delete">确定</button>
        `;

        // 定位确认提示在删除按钮旁边
        deleteButton.after(confirmPrompt);

        // 添加确认删除的事件监听器
        confirmPrompt.querySelector('.confirm-delete').addEventListener('click', async () => {
            try {
                const table = event.category === '节日' ? 'holidays' : 'seasonal_events';
                const { error } = await this.supabase
                    .from(table)
                    .delete()
                    .eq('id', event.id);

                if (error) throw error;

                // 更新本地数据
                if (event.category === '节日') {
                    this.events.holidays[event.region] = this.events.holidays[event.region]
                        .filter(h => h.id !== event.id);
                } else {
                    this.events.seasonal = this.events.seasonal
                        .filter(s => s.id !== event.id);
                }

                if (this.currentPopup) {
                    document.body.removeChild(this.currentPopup);
                    this.currentPopup = null;
                }

                this.renderCalendar();
            } catch (error) {
                console.error('Error deleting event:', error);
                alert('删除事件失败');
            }
        });

        // 点击其他地方时移除确认提示
        const removeConfirm = (e) => {
            if (!confirmPrompt.contains(e.target) && !deleteButton.contains(e.target)) {
                confirmPrompt.remove();
                document.removeEventListener('click', removeConfirm);
            }
        };

        document.addEventListener('click', removeConfirm);
    }

    initEventForm() {
        // 添加事件按钮
        document.getElementById('addEventBtn').addEventListener('click', () => {
            const form = document.getElementById('newEventForm');
            form.reset();
            // 清除编辑模式标记
            delete form.dataset.editMode;
            delete form.dataset.eventId;
            delete form.dataset.originalRegion;
            // 清空产品列表
            document.getElementById('productsList').innerHTML = '';
            // 显示表单
            const formPopup = document.getElementById('eventForm');
            formPopup.style.display = 'flex';
        });

        // 取消按钮
        document.getElementById('cancelEventBtn').addEventListener('click', () => {
            const form = document.getElementById('newEventForm');
            form.reset();
            document.getElementById('eventForm').style.display = 'none';
            document.getElementById('productsList').innerHTML = '';
        });

        // 点击背景关闭表单
        document.getElementById('eventForm').addEventListener('click', (e) => {
            if (e.target.id === 'eventForm') {
                document.getElementById('eventForm').style.display = 'none';
            }
        });

        // 添加产品类别按钮
        document.getElementById('addProductBtn').addEventListener('click', () => {
            const productsList = document.getElementById('productsList');
            const newEntry = document.createElement('div');
            newEntry.className = 'product-entry';
            newEntry.innerHTML = `
                <input type="text" name="productCategory[]" placeholder="产品类别">
                <input type="text" name="products[]" placeholder="产品（用逗号分隔）">
                <button type="button" class="remove-product">删除</button>
            `;
            productsList.appendChild(newEntry);
        });

        // 删除产品按钮的点击事件委托
        document.getElementById('productsList').addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-product')) {
                e.target.parentElement.remove();
            }
        });

        // 表单提交
        document.getElementById('newEventForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                const formData = new FormData(e.target);
                
                // 收集产品数据
                const products = {};
                const categories = formData.getAll('productCategory[]');
                const productLists = formData.getAll('products[]');
                
                categories.forEach((category, index) => {
                    if (category && productLists[index]) {
                        products[category] = productLists[index].split(/[,，、]/).map(p => p.trim());
                    }
                });

                // 创建事件对象
                const eventData = {
                    date: formData.get('date'),
                    name: formData.get('name'),
                    description: formData.get('description') || '',
                    category: formData.get('category') || (formData.get('eventType') === 'holiday' ? '节日' : '季节性活动'),
                    region: formData.get('region'),
                    products: products
                };

                // 如果是季节性活动，添加持续时间
                if (formData.get('eventType') === 'seasonal') {
                    eventData.duration = parseInt(formData.get('duration') || '1', 10);
                }

                let success = false;

                // 检查是否在编辑模式
                if (e.target.dataset.editMode === 'true') {
                    const originalId = e.target.dataset.eventId;
                    const eventType = formData.get('eventType');
                    const table = eventType === 'holiday' ? 'holidays' : 'seasonal_events';

                    // 更新数据库中的事件
                    const { data, error } = await this.supabase
                        .from(table)
                        .update(eventData)
                        .eq('id', originalId)
                        .select();

                    if (error) throw error;

                    if (data && data.length > 0) {
                        // 更新本地数据
                        if (eventType === 'holiday') {
                            // 移除旧事件
                            const oldRegion = e.target.dataset.originalRegion;
                            if (this.events.holidays[oldRegion]) {
                                this.events.holidays[oldRegion] = this.events.holidays[oldRegion]
                                    .filter(h => h.id !== originalId);
                            }
                            // 添加更新后的事件
                            if (!this.events.holidays[eventData.region]) {
                                this.events.holidays[eventData.region] = [];
                            }
                            this.events.holidays[eventData.region].push(data[0]);
                        } else {
                            this.events.seasonal = this.events.seasonal
                                .filter(s => s.id !== originalId);
                            this.events.seasonal.push(data[0]);
                        }
                        success = true;
                    }
                } else {
                    // 添加新事件
                    success = await this.addEvent(eventData, formData.get('eventType'));
                }

                if (success) {
                    // 关闭表单
                    document.getElementById('eventForm').style.display = 'none';
                    // 重置表单
                    e.target.reset();
                    // 清空产品列表
                    document.getElementById('productsList').innerHTML = '';
                    // 清除编辑模式标记
                    delete e.target.dataset.editMode;
                    delete e.target.dataset.eventId;
                    delete e.target.dataset.originalRegion;
                    // 重新渲染日历
                    this.renderCalendar();
                }
            } catch (error) {
                console.error('提交表单错误:', error);
                alert('保存事件失败: ' + error.message);
            }
        });

        // 解析文本按钮点击事件
        document.getElementById('parseTextBtn').addEventListener('click', () => {
            const text = document.querySelector('textarea[name="quickInput"]').value;
            if (!text) return;

            // 日期匹配模式
            const datePattern = /(\d{4})年(\d{1,2})月(\d{1,2})?[日号]?/;
            const dateMatch = text.match(datePattern);
            
            if (dateMatch) {
                const year = dateMatch[1];
                const month = dateMatch[2].padStart(2, '0');
                const day = (dateMatch[3] || '1').padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;
                
                // 设置日期
                document.querySelector('input[name="date"]').value = dateStr;
                
                // 识别并设置地区
                const region = this.detectRegion(text);
                document.querySelector('select[name="region"]').value = region;

                // 提取事件名称（在日期之后的第一个包含"节"、"季"或"促销"的词组）
                const eventPattern = /[\u4e00-\u9fa5]+(节|季|促销|活动)/;
                const eventMatch = text.match(eventPattern);
                if (eventMatch) {
                    document.querySelector('input[name="name"]').value = eventMatch[0];
                }

                // 提取描述（去掉日期和事件名称后的其余部分）
                let description = text;
                if (dateMatch) {
                    description = description.replace(dateMatch[0], '');
                }
                if (eventMatch) {
                    description = description.replace(eventMatch[0], '');
                }
                description = description.trim().replace(/^[,，、]/, '');
                document.querySelector('textarea[name="description"]').value = description;

                // 提取产品信息
                const productsList = document.getElementById('productsList');
                productsList.innerHTML = ''; // 清空现有产品列表

                // 尝试从描述中提取产品
                const products = description.match(/[、，]([^、，]+)/g);
                if (products && products.length > 0) {
                    const productEntry = document.createElement('div');
                    productEntry.className = 'product-entry';
                    productEntry.innerHTML = `
                        <input type="text" name="productCategory[]" value="主要产品">
                        <input type="text" name="products[]" value="${products.map(p => p.replace(/[、，]/g, '').trim()).join('、')}">
                        <button type="button" class="remove-product">删除</button>
                    `;
                    productsList.appendChild(productEntry);
                }

                // 根据事件名称判断事件类型
                const eventType = document.querySelector('select[name="eventType"]');
                if (eventMatch) {
                    if (eventMatch[0].includes('节')) {
                        eventType.value = 'holiday';
                    } else {
                        eventType.value = 'seasonal';
                    }
                }
            }
        });
    }

    parseEventText(text) {
        console.log('Parsing text:', text);
        if (!text) return null;

        // 改进的日期匹配模式
        const datePattern = /(\d{4})年(\d{1,2})月(?:的)?(\d{1,2})?[日号]?/;
        const dateMatch = text.match(datePattern);
        console.log('Date match:', dateMatch);

        if (!dateMatch) return null;

        // 提取日期
        const year = dateMatch[1] || this.currentDate.getFullYear();
        const month = dateMatch[2].padStart(2, '0');
        const day = (dateMatch[3] || '1').padStart(2, '0');
        const date = `${year}-${month}-${day}`;

        // 智能提取事件名称和类型
        let name = '';
        let category = '';
        
        // 定义关键词映射
        const categoryKeywords = {
            '开学': '开学季',
            '': '季节性活动',
            '节': '节日',
            '促销': '促销活动',
            '活动': '促销活动'
        };
        
        // 提取事件名称和类型
        const eventPattern = /([\u4e00-\u9fa5]+[季节活动])/;
        const eventMatch = text.match(eventPattern);
        if (eventMatch) {
            name = eventMatch[1];
            // 根据关键词确定类别
            for (const [keyword, cat] of Object.entries(categoryKeywords)) {
                if (name.includes(keyword)) {
                    category = cat;
                    break;
                }
            }
        }

        // 提取产品
        const products = [];
        // 产品提取逻辑
        const productPatterns = [
            /[准需要]([^，。]+)/,
            /包[括]([^，。]+)/,
            /[如像比]([^，。]+)/
        ];
        
        for (const pattern of productPatterns) {
            const match = text.match(pattern);
            if (match) {
                const productText = match[1];
                // 分割产品并过滤值
                const productList = productText.split(/[,，、及]/)
                    .map(p => p.trim())
                    .filter(p => p && p.length > 0);
                products.push(...productList);
                break;
            }
        }

        // 智能分类产品
        const categorizedProducts = {};
        if (products.length > 0) {
            // 根据事件类型自动分类产品
            if (category === '开学季') {
                categorizedProducts['学习用品'] = products.filter(p => 
                    p.includes('文具') || p.includes('书') || p.includes('本'));
                categorizedProducts['电子产品'] = products.filter(p => 
                    p.includes('') || p.includes('机') || p.includes('器'));
                categorizedProducts['生活用品'] = products.filter(p => 
                    !categorizedProducts['学习用品'].includes(p) && 
                    !categorizedProducts['电子产品'].includes(p));
            } else {
                categorizedProducts['主要产品'] = products;
            }
        }

        const result = {
            date,
            name,
            category,
            products: categorizedProducts
        };
        
        console.log('Parsed result:', result);
        return result;
    }

    renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        document.getElementById('currentMonth').textContent = 
            `${year}年${month + 1}月`;

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysContainer = document.getElementById('calendar-days');
        daysContainer.innerHTML = '';

        // 填充当前月的天数
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dayElement = this.createDayElement(day);
            const currentDate = new Date(year, month, day);
            
            // 添加日期属性用于定位
            dayElement.setAttribute('data-date', currentDate.toISOString().split('T')[0]);
            
            // 添加日和活动
            this.addEvents(dayElement, currentDate);
            
            daysContainer.appendChild(dayElement);
        }
        
        // 更新未来事件列表
        this.renderFutureEvents();
    }

    createDayElement(day = '') {
        const div = document.createElement('div');
        div.className = 'calendar-day';
        if (day) {
            div.innerHTML = `<div class="date">${day}</div>`;
            const currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
            const today = new Date(this.today.getFullYear(), this.today.getMonth(), this.today.getDate());
            
            if (currentDate.getTime() === today.getTime()) {
                div.classList.add('today');
            }
            
            if (currentDate < today) {
                div.classList.add('past-date');
            }
        }
        return div;
    }

    createPopup(event, clickEvent) {
        // 如果已经有弹窗，先关闭
        if (this.currentPopup) {
            document.body.removeChild(this.currentPopup);
            this.currentPopup = null;
            // 移除之前的点击事件监听器
            document.removeEventListener('click', this._currentCloseHandler);
        }

        const popup = document.createElement('div');
        popup.className = 'event-popup';
        
        // 设置弹窗内容
        let html = `
            <div class="event-header">
                <div class="event-title" contenteditable="true">${event.name}</div>
                <button class="delete-event" title="删除事件">
                    <i class="fas fa-trash"></i>
                </button>
                <div class="event-meta">
                    <div class="event-time">
                        <i class="far fa-clock"></i>
                        <input type="date" value="${event.date}" class="date-input">
                    </div>
                </div>
            </div>`;

        // 添加提示信息部分
        if (event.description) {
            html += `
            <div class="event-tips">
                <i class="fas fa-lightbulb"></i>
                <div class="tips-content" contenteditable="true">${event.description}</div>
            </div>`;
        }

        // 添加产品信息部分
        if (event.products && Object.keys(event.products).length > 0) {
            html += `<div class="event-products">`;
            for (const [category, products] of Object.entries(event.products)) {
                html += `
                <div class="product-category">
                    <div class="category-header">
                        <div class="category-name" contenteditable="true">${category}：</div>
                        <button class="delete-category">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="product-list" contenteditable="true">${products.join('、')}</div>
                </div>`;
            }
            html += `</div>`;
        }

        // 添加历史产品信息部分
        html += `
        <div class="event-products history-products">
            <h4>往年热销产品</h4>`;
            
        // 显示已有的历史产品数据
        if (event.history_products && Object.keys(event.history_products).length > 0) {
            for (const [category, data] of Object.entries(event.history_products)) {
                html += `
                <div class="product-category">
                    <div class="category-header">
                        <div class="category-name" contenteditable="true">${category}</div>
                        <button class="delete-category">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="list-row">
                        <span class="list-label">SKU:</span>
                        <span class="list-content" contenteditable="true">${data.skus ? data.skus.join(',') : ''}</span>
                        <button class="add-item" data-type="sku">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="copy-sku" title="复制SKU">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>`;
            }
        }

        // 添加新类别的模板
        html += `
            <button class="add-category">
                <i class="fas fa-plus"></i> 添加产品类别
            </button>
        </div>`;

        // 添加保存按钮
        html += `
        <div class="form-actions">
            <button class="save-event">保存</button>
        </div>`;

        popup.innerHTML = html;
        document.body.appendChild(popup);
        this.currentPopup = popup;

        // 添加新类别的事件处理
        const addCategoryBtn = popup.querySelector('.history-products .add-category');
        if (addCategoryBtn) {
            addCategoryBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const newCategory = document.createElement('div');
                newCategory.className = 'product-category';
                newCategory.innerHTML = `
                    <div class="category-header">
                        <div class="category-name" contenteditable="true">新产品类别</div>
                        <button class="delete-category">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="list-row">
                        <span class="list-label">SKU:</span>
                        <span class="list-content" contenteditable="true"></span>
                        <button class="add-item" data-type="sku">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="copy-sku" title="复制SKU">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                `;
                
                // 将新类别插入到"添加类别"按钮之前
                addCategoryBtn.parentElement.insertBefore(newCategory, addCategoryBtn);
                
                // 为新添加的类别绑定删除事件
                const deleteBtn = newCategory.querySelector('.delete-category');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        newCategory.remove();
                    });
                }
                
                // 为新添加的SKU按钮绑定事件
                const addSkuBtn = newCategory.querySelector('.add-item');
                if (addSkuBtn) {
                    addSkuBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const input = prompt('请输入SKU：');
                        if (input) {
                            const listContent = newCategory.querySelector('.list-content');
                            const currentContent = listContent.textContent.trim();
                            if (currentContent) {
                                listContent.textContent = currentContent + ',' + input.trim();
                            } else {
                                listContent.textContent = input.trim();
                            }
                        }
                    });
                }
                
                // 为新添加的复制按钮绑定事件
                const copyBtn = newCategory.querySelector('.copy-sku');
                if (copyBtn) {
                    copyBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const skuContent = newCategory.querySelector('.list-content').textContent.trim();
                        if (skuContent) {
                            navigator.clipboard.writeText(skuContent)
                                .then(() => alert('SKU已复制到剪贴板'))
                                .catch(err => console.error('复制失败:', err));
                        }
                    });
                }
            });
        }

        // 为现有的删除类别按钮绑定事件
        popup.querySelectorAll('.history-products .delete-category').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                btn.closest('.product-category').remove();
            });
        });

        // 为现有的添加SKU按钮绑定事件
        popup.querySelectorAll('.history-products .add-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const input = prompt('请输入SKU：');
                if (input) {
                    const listContent = btn.closest('.list-row').querySelector('.list-content');
                    const currentContent = listContent.textContent.trim();
                    if (currentContent) {
                        listContent.textContent = currentContent + ',' + input.trim();
                    } else {
                        listContent.textContent = input.trim();
                    }
                }
            });
        });

        // 为现有的复制按钮绑定事件
        popup.querySelectorAll('.history-products .copy-sku').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const skuContent = btn.closest('.list-row').querySelector('.list-content').textContent.trim();
                if (skuContent) {
                    navigator.clipboard.writeText(skuContent)
                        .then(() => alert('SKU已复制到剪贴板'))
                        .catch(err => console.error('复制失败:', err));
                }
            });
        });

        // 计算弹窗位置
        const rect = clickEvent.target.closest('.future-event, .calendar-day')?.getBoundingClientRect() || clickEvent.target.getBoundingClientRect();
        const popupRect = popup.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // 默认显示在点击位置的右侧
        let left = rect.right + 10;
        let top = rect.top;

        // 如果右侧空间不足，显示在左侧
        if (left + popupRect.width > windowWidth - 20) {
            left = rect.left - popupRect.width - 10;
        }

        // 如果左侧也没有足够空间，居中显示
        if (left < 20) {
            left = (windowWidth - popupRect.width) / 2;
        }

        // 确保弹窗不会超出顶部和底部
        top = Math.max(20, Math.min(top, windowHeight - popupRect.height - 20));

        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;

        // 创建新的关闭处理函数
        this._currentCloseHandler = (e) => {
            if (!popup.contains(e.target) && !e.target.closest('.future-event, .calendar-day')) {
                document.body.removeChild(popup);
                this.currentPopup = null;
                document.removeEventListener('click', this._currentCloseHandler);
            }
        };

        // 延迟添加事件监听器
        setTimeout(() => {
            document.addEventListener('click', this._currentCloseHandler);
        }, 100);

        // 处理删除事件
        const deleteBtn = popup.querySelector('.delete-event');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('确定要删除这个事件吗？')) {
                    await this.deleteEvent(event);
                    document.body.removeChild(popup);
                    this.currentPopup = null;
                    document.removeEventListener('click', this._currentCloseHandler);
                }
            });
        }

        // 处理保存事件
        const saveBtn = popup.querySelector('.save-event');
        if (saveBtn) {
            saveBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                // 获取更新后的事件数据
                const updatedEvent = {
                    ...event,
                    name: popup.querySelector('.event-title').textContent.trim(),
                    date: popup.querySelector('.date-input').value,
                    description: popup.querySelector('.tips-content')?.textContent.trim() || '',
                    products: {},
                    history_products: {}
                };

                // 收集产品信息
                const productCategories = popup.querySelectorAll('.event-products:not(.history-products) .product-category');
                productCategories.forEach(category => {
                    const categoryName = category.querySelector('.category-name').textContent.replace('：', '').trim();
                    const productList = category.querySelector('.product-list').textContent.split('、').map(p => p.trim());
                    if (categoryName && productList.length > 0) {
                        updatedEvent.products[categoryName] = productList;
                    }
                });

                // 收集历史产品信息
                const historyCategories = popup.querySelectorAll('.history-products .product-category');
                historyCategories.forEach(category => {
                    const categoryName = category.querySelector('.category-name').textContent.trim();
                    const skuContent = category.querySelector('.list-content').textContent;
                    const skuList = skuContent ? skuContent.split(',').map(p => p.trim()).filter(Boolean) : [];
                    if (categoryName && skuList.length > 0) {
                        updatedEvent.history_products[categoryName] = {
                            skus: skuList
                        };
                    }
                });

                try {
                    // 根据事件类型选择表
                    const table = event.category === '节日' ? 'holidays' : 'seasonal_events';
                    
                    // 移除不需要的字段
                    const { displayDate, daysDiff, ...eventData } = updatedEvent;
                    
                    // 更新数据库
                    const { data, error } = await this.supabase
                        .from(table)
                        .update(eventData)
                        .eq('id', event.id)
                        .select();

                    if (error) throw error;

                    if (data && data.length > 0) {
                        // 更新本地数据
                        if (event.category === '节日') {
                            this.events.holidays[event.region] = this.events.holidays[event.region]
                                .map(h => h.id === event.id ? data[0] : h);
                        } else {
                            this.events.seasonal = this.events.seasonal
                                .map(s => s.id === event.id ? data[0] : s);
                        }

                        // 关闭弹窗
                        document.body.removeChild(popup);
                        this.currentPopup = null;
                        document.removeEventListener('click', this._currentCloseHandler);

                        // 重新渲染日历
                        this.renderCalendar();
                        
                        // 显示成功消息
                        alert('保存成功！');
                    }
                } catch (error) {
                    console.error('保存事件错误:', error);
                    alert('保存事件失败: ' + error.message);
                }
            });
        }
    }

    addEvents(dayElement, date) {
        const dateString = date.toISOString().split('T')[0];
        
        // 用于存储同一天的事件，以事件名称为key
        const dayEvents = new Map();

        // 收集节日
        for (const region in this.events.holidays) {
            if (this.selectedRegions.has('all') || this.selectedRegions.has(region)) {
                const holidays = this.events.holidays[region];
                holidays.forEach(holiday => {
                    if (this.compareDates(holiday.date, dateString)) {
                        const key = holiday.name;
                        if (!dayEvents.has(key)) {
                            dayEvents.set(key, {
                                event: {...holiday, displayDate: holiday.date},
                                regions: new Set([region])
                            });
                        } else {
                            dayEvents.get(key).regions.add(region);
                        }
                    }
                });
            }
        }

        // 收集季节性活动
        this.events.seasonal.forEach(event => {
            if (this.compareDates(event.date, dateString) &&
                (this.selectedRegions.has('all') || this.selectedRegions.has(event.region))) {
                const key = event.name;
                if (!dayEvents.has(key)) {
                    dayEvents.set(key, {
                        event: {...event, displayDate: event.date},
                        regions: new Set([event.region])
                    });
                } else {
                    dayEvents.get(key).regions.add(event.region);
                }
            }
        });

        // 渲染合并后的事件
        dayEvents.forEach(({ event, regions }, eventName) => {
            const eventDiv = document.createElement('div');
            eventDiv.className = `event ${event.category === '节日' ? 'holiday' : 'seasonal'}`;
            
            // 将地区名称按字母顺序排序并转换为中文名称
            const regionNames = Array.from(regions)
                .sort()
                .map(region => this.getRegionName(region))
                .join('、');
            
            eventDiv.innerHTML = `<span class="event-name">${eventName}</span>(${regionNames})`;
            eventDiv.title = `${eventName} (${regionNames})`;
            
            // 修改点击事件处理，移除displayDate
            eventDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                this.createPopup(event, e);
            });
            
            dayElement.appendChild(eventDiv);
        });
    }

    attachEventListeners() {
        document.getElementById('prevMonth').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.renderCalendar();
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.renderCalendar();
        });

        document.getElementById('todayBtn').addEventListener('click', () => {
            this.currentDate = new Date();
            this.renderCalendar();
        });

        // 地区筛选监听
        const checkboxes = document.querySelectorAll('.region-filter input');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                if (e.target.value === 'all') {
                    this.selectedRegions.clear();
                    if (e.target.checked) {
                        this.selectedRegions.add('all');
                        checkboxes.forEach(cb => {
                            if (cb.value !== 'all') cb.checked = false;
                        });
                    }
                } else {
                    if (e.target.checked) {
                        this.selectedRegions.delete('all');
                        document.querySelector('input[value="all"]').checked = false;
                        this.selectedRegions.add(e.target.value);
                    } else {
                        this.selectedRegions.delete(e.target.value);
                    }
                }
                this.renderCalendar();
            });
        });

        // 添加新事件按钮的事件监听器
        document.getElementById('addEventBtn').addEventListener('click', () => {
            if (!this.verifyPassword()) {
                alert('密码错误！');
                return;
            }
            const form = document.getElementById('newEventForm');
            form.reset();
            delete form.dataset.editMode;
            delete form.dataset.eventId;
            delete form.dataset.originalRegion;
            document.getElementById('productsList').innerHTML = '';
            document.getElementById('eventForm').style.display = 'flex';
        });

        // 添加导入数据按钮的事件监听器
        document.getElementById('importDataBtn').addEventListener('click', () => {
            if (!this.verifyPassword()) {
                alert('密码错误！');
                return;
            }
            this.importDataToSupabase();
        });

        // 添加清空数据按钮的事件监听器
        document.getElementById('clearDataBtn').addEventListener('click', () => {
            if (!this.verifyPassword()) {
                alert('密码错误！');
                return;
            }
            this.clearAllData();
        });
    }

    // 添加删除事件的方法
    deleteEvent(event) {
        const deleteButton = document.querySelector('.delete-event');
        const confirmPrompt = document.createElement('div');
        confirmPrompt.className = 'delete-confirm';
        confirmPrompt.innerHTML = `
            <span>确定删除？</span>
            <button class="confirm-delete">确定</button>
        `;

        // 定位确认提示在删除按钮旁边
        deleteButton.after(confirmPrompt);

        // 添加确认删除的事件监听器
        confirmPrompt.querySelector('.confirm-delete').addEventListener('click', async () => {
            try {
                const table = event.category === '节日' ? 'holidays' : 'seasonal_events';
                const { error } = await this.supabase
                    .from(table)
                    .delete()
                    .eq('id', event.id);

                if (error) throw error;

                // 更新本地数据
                if (event.category === '节日') {
                    this.events.holidays[event.region] = this.events.holidays[event.region]
                        .filter(h => h.id !== event.id);
                } else {
                    this.events.seasonal = this.events.seasonal
                        .filter(s => s.id !== event.id);
                }

                if (this.currentPopup) {
                    document.body.removeChild(this.currentPopup);
                    this.currentPopup = null;
                }

                this.renderCalendar();
            } catch (error) {
                console.error('Error deleting event:', error);
                alert('删除事件失败');
            }
        });

        // 点击其他地方时移除确认提示
        const removeConfirm = (e) => {
            if (!confirmPrompt.contains(e.target) && !deleteButton.contains(e.target)) {
                confirmPrompt.remove();
                document.removeEventListener('click', removeConfirm);
            }
        };

        document.addEventListener('click', removeConfirm);
    }

    // 添加一个辅助方法来标准化日期格式（忽略年份）
    normalizeDate(dateString) {
        const date = new Date(dateString);
        return `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    }

    // 添加一个方法来比较两个日期（忽略年份，事件日期提前一天显示）
    compareDates(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        
        // 将事件日期提前一天
        d1.setDate(d1.getDate() - 1);
        
        return d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    }

    // 添加编辑事件的方法
    editEvent(event) {
        // 显示表单
        const form = document.getElementById('newEventForm');
        document.getElementById('eventForm').style.display = 'flex';

        // 填充表单数据
        form.querySelector('select[name="eventType"]').value = 
            event.category === '节日' ? 'holiday' : 'seasonal';
        form.querySelector('select[name="region"]').value = event.region || 'thailand';
        form.querySelector('input[name="name"]').value = event.name;
        form.querySelector('input[name="date"]').value = event.date;
        form.querySelector('textarea[name="description"]').value = event.description || '';
        form.querySelector('input[name="category"]').value = event.category;

        // 清空并重填充产品列表
        const productsList = document.getElementById('productsList');
        productsList.innerHTML = '';

        if (event.products) {
            if (Array.isArray(event.products)) {
                const productEntry = document.createElement('div');
                productEntry.className = 'product-entry';
                productEntry.innerHTML = `
                    <input type="text" name="productCategory[]" value="主要产品">
                    <input type="text" name="products[]" value="${event.products.join('、')}">
                    <button type="button" class="remove-product">删除</button>
                `;
                productsList.appendChild(productEntry);
            } else {
                for (const [category, products] of Object.entries(event.products)) {
                    const productEntry = document.createElement('div');
                    productEntry.className = 'product-entry';
                    productEntry.innerHTML = `
                        <input type="text" name="productCategory[]" value="${category}">
                        <input type="text" name="products[]" value="${products.join('、')}">
                        <button type="button" class="remove-product">删除</button>
                    `;
                    productsList.appendChild(productEntry);
                }
            }
        }

        // 保存编辑模式信息
        form.dataset.editMode = 'true';
        form.dataset.eventId = event.id;
        form.dataset.originalRegion = event.region;

        // 关闭事件弹窗
        if (this.currentPopup) {
            document.body.removeChild(this.currentPopup);
            this.currentPopup = null;
        }
    }

    // 添加地区识别方法
    detectRegion(text) {
        const regionMap = {
            '泰国': 'thailand',
            '马来西亚': 'malaysia',
            '马来': 'malaysia',
            '印尼': 'indonesia',
            '印度尼西亚': 'indonesia',
            '菲律宾': 'philippines',
            '菲': 'philippines'
        };

        for (const [cn, en] of Object.entries(regionMap)) {
            if (text.includes(cn)) {
                return en;
            }
        }
        return 'thailand'; // 默认返回泰国
    }

    // 添加获地区名称的方法
    getRegionName(region) {
        const regionMap = {
            'thailand': '泰国',
            'malaysia': '马来西亚',
            'indonesia': '印',
            'philippines': '菲律宾'
        };
        return regionMap[region] || region;
    }

    // 生成 UUID 的辅助函数
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    async importDataToSupabase() {
        try {
            if (!confirm('导入数据会清空现有数据，确定要继续吗？')) {
                return;
            }

            // 清空现有数据
            const { error: clearHolidaysError } = await this.supabase
                .from('holidays')
                .delete()
                .not('id', 'is', null);
            if (clearHolidaysError) throw clearHolidaysError;

            const { error: clearSeasonalError } = await this.supabase
                .from('seasonal_events')
                .delete()
                .not('id', 'is', null);
            if (clearSeasonalError) throw clearSeasonalError;

            // 导入节日数据
            for (const region in calendarData.holidays) {
                const holidays = calendarData.holidays[region];
                for (const holiday of holidays) {
                    const { error } = await this.supabase
                        .from('holidays')
                        .insert({
                            id: this.generateUUID(),
                            date: holiday.date,
                            name: holiday.name,
                            description: holiday.description || '',
                            category: holiday.category || '节日',
                            region: region,
                            products: holiday.products || {}
                        });
                    
                    if (error) {
                        console.error('导入节日数据错误:', error);
                        throw error;
                    }
                }
            }

            // 导入季节性活动数据
            for (const event of calendarData.seasonal) {
                const { error } = await this.supabase
                    .from('seasonal_events')
                    .insert({
                        id: this.generateUUID(),
                        date: event.date,
                        name: event.name,
                        description: event.description || '',
                        category: event.category || '季节性活动',
                        region: event.region,
                        duration: event.duration || 1,
                        products: event.products || {}
                    });
                
                if (error) {
                    console.error('导入季节性活动数据错误:', error);
                    throw error;
                }
            }

            alert('数据导入成功！');
            // 重新加载数据
            await this.loadEvents();
            this.renderCalendar();
        } catch (error) {
            console.error('导入数据错误:', error);
            alert('导入数据失败: ' + error.message);
        }
    }

    async clearAllData() {
        try {
            if (!confirm('此操作将清空所有事件数据，确定要继续吗？')) {
                return;
            }

            // 清空节日数
            const { error: clearHolidaysError } = await this.supabase
                .from('holidays')
                .delete()
                .not('id', 'is', null);
            if (clearHolidaysError) throw clearHolidaysError;

            // 清空季节性活动数据
            const { error: clearSeasonalError } = await this.supabase
                .from('seasonal_events')
                .delete()
                .not('id', 'is', null);
            if (clearSeasonalError) throw clearSeasonalError;

            // 重置本地数据
            this.events = {
                holidays: {
                    'thailand': [],
                    'malaysia': [],
                    'indonesia': [],
                    'philippines': []
                },
                seasonal: []
            };

            // 重新渲染日历
            this.renderCalendar();
            alert('所有数据已清空！');
        } catch (error) {
            console.error('清空数据错误:', error);
            alert('清空数据失败: ' + error.message);
        }
    }

    // 添加新方法：渲染未来事件列表
    renderFutureEvents() {
        const futureEventsList = document.querySelector('.future-events-list');
        if (!futureEventsList) return;

        futureEventsList.innerHTML = '';
        const today = new Date();
        const futureEvents = [];

        // 收集所有事件
        for (const region in this.events.holidays) {
            this.events.holidays[region].forEach(event => {
                const eventDate = new Date(event.date);
                const daysDiff = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
                if (daysDiff >= 0 && daysDiff <= 100) {
                    futureEvents.push({ ...event, daysDiff });
                }
            });
        }

        this.events.seasonal.forEach(event => {
            const eventDate = new Date(event.date);
            const daysDiff = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
            if (daysDiff >= 0 && daysDiff <= 100) {
                futureEvents.push({ ...event, daysDiff });
            }
        });

        // 按日期排序
        futureEvents.sort((a, b) => a.daysDiff - b.daysDiff);

        // 渲染事件列表
        futureEvents.forEach(event => {
            const eventElement = document.createElement('div');
            eventElement.className = 'future-event';
            const eventDate = new Date(event.date);
            const formattedDate = `${eventDate.getMonth() + 1}月${eventDate.getDate()}日`;
            
            eventElement.innerHTML = `
                <div class="event-name">${event.name} (${this.getRegionName(event.region)})</div>
                <div class="event-date">${formattedDate}</div>
                <div class="countdown">还有 ${event.daysDiff} 天</div>
            `;

            // 添加点击事件
            eventElement.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                
                // 移除现有弹窗
                if (this.currentPopup) {
                    document.body.removeChild(this.currentPopup);
                    this.currentPopup = null;
                    // 移除之前的点击事件监听器
                    document.removeEventListener('click', this._currentCloseHandler);
                }
                
                // 创建新弹窗
                this.createPopup(event, e);
            });

            futureEventsList.appendChild(eventElement);
        });
    }
    
    // 添加新方法：计算两个日期之间的天数差
    calculateDaysDifference(date1, date2) {
        const oneDay = 24 * 60 * 60 * 1000; // 一天的毫秒数
        // 去除时间部分，只比较日期
        const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
        const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
        return Math.round((d2 - d1) / oneDay);
    }

    // 添加密码验证方法
    verifyPassword() {
        const password = prompt('请输入密码：');
        return password === '1';
    }
}

// 初始化日历
document.addEventListener('DOMContentLoaded', () => {
    new Calendar();
}); 