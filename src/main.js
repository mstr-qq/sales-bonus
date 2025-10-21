function calculateSimpleRevenue(purchase, product) {
    // Добавлена валидация типов и значений
    if (typeof purchase.sale_price !== 'number' || purchase.sale_price < 0) {
        throw new Error('Некорректная цена продажи');
    }
    if (typeof purchase.quantity !== 'number' || purchase.quantity < 0) {
        throw new Error('Некорректное количество');
    }
    if (typeof purchase.discount !== 'number' || purchase.discount < 0 || purchase.discount > 100) {
        throw new Error('Некорректная скидка');
    }

    const discountMultiplier = 1 - (purchase.discount / 100);
    return purchase.sale_price * purchase.quantity * discountMultiplier;
}

function calculateBonusByProfit(index, total, seller) {
    // Добавлена валидация profit
    if (typeof seller.profit !== 'number') {
        throw new Error('Некорректный profit');
    }

    let bonusRate;
    if (index === 0) {
        bonusRate = 0.15;
    } else if (index === 1 || index === 2) {
        bonusRate = 0.10;
    } else if (index === total - 1) {
        bonusRate = 0;
    } else {
        bonusRate = 0.05;
    }
    
    // Бонус не может быть отрицательным
    return Math.max(0, seller.profit * bonusRate);
}

function analyzeSalesData(data, options) {
    if (!data
        || !Array.isArray(data.sellers)
        || !Array.isArray(data.products)
        || !Array.isArray(data.purchase_records)
        || data.sellers.length === 0
        || data.products.length === 0
        || data.purchase_records.length === 0
    ) {
        throw new Error('Некорректные входные данные');
    }

    if (typeof options !== "object" || options === null) {
        throw new Error('Опции должны быть объектом');
    }

    const { calculateRevenue, calculateBonus } = options;
    
    if (!calculateRevenue || !calculateBonus) {
        throw new Error('В опциях отсутствуют необходимые функции');
    }

    if (typeof calculateRevenue !== "function" || typeof calculateBonus !== "function") {
        throw new Error('calculateRevenue и calculateBonus должны быть функциями');
    }

    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {},
        top_products: []
    }));

    const sellerIndex = sellerStats.reduce((result, sellerStat) => ({
        ...result,
        [sellerStat.id]: sellerStat
    }), {});

    // Изменено: индекс по sku (предполагаем, что sku и article совпадают; если нет, скорректируйте данные)
    const productIndex = data.products.reduce((result, product) => ({
        ...result,
        [product.sku]: product
    }), {});

    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        
        if (!seller) {
            console.warn(`Продавец с id ${record.seller_id} не найден, пропускаем чек`);
            return;
        }
        
        seller.sales_count += 1;
        // Удалено: seller.revenue += record.total_amount; (теперь revenue суммируется из calculateRevenue)
        
        record.items.forEach(item => {
            // Добавлена валидация item
            if (typeof item.quantity !== 'number' || item.quantity < 0) {
                console.warn(`Некорректное количество для товара ${item.sku}`);
                return;
            }
            if (typeof item.sku !== 'string' || !item.sku) {
                console.warn('Некорректный sku товара');
                return;
            }

            const product = productIndex[item.sku];
            
            if (!product) {
                console.warn(`Товар с артикулом ${item.sku} не найден, пропускаем`);
                return;
            }
            
            // Добавлена валидация product.purchase_price
            if (typeof product.purchase_price !== 'number' || product.purchase_price < 0) {
                console.warn(`Некорректная цена закупки для товара ${item.sku}`);
                return;
            }

            const cost = product.purchase_price * item.quantity;
            const revenue = calculateRevenue(item, product);
            const profit = revenue - cost;
            
            // Округление revenue перед суммированием для соответствия тестам
            seller.revenue += +(revenue.toFixed(2));
            seller.profit += profit;
            
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    sellerStats.sort((a, b) => b.profit - a.profit);

    sellerStats.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, sellerStats.length, seller);
        
        // Убрано product_name из top_products для соответствия ожидаемому результату теста
        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({
                sku: sku,
                quantity: quantity
            }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
    });

    return sellerStats.map(seller => ({
        seller_id: seller.id,
        name: seller.name,
        revenue: +(seller.revenue.toFixed(2)),
        profit: +(seller.profit.toFixed(2)),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +(seller.bonus.toFixed(2))
    }));
}
