function calculateSimpleRevenue(purchase, product) {
    const discountMultiplier = 1 - (purchase.discount / 100);
    return purchase.sale_price * purchase.quantity * discountMultiplier;
}

function calculateBonusByProfit(index, total, seller) {
    const { profit } = seller;
    
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
    
    return profit * bonusRate;
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

    // Создаем статистику для всех продавцов
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {}
    }));

    // Создаем индексы для быстрого доступа
    const sellerIndex = {};
    data.sellers.forEach(seller => {
        const stat = sellerStats.find(s => s.id === seller.id);
        if (stat) {
            sellerIndex[seller.id] = stat;
        }
    });

    const productIndex = {};
    data.products.forEach(product => {
        productIndex[product.article] = product;
    });

    // Обрабатываем каждую запись о продаже
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        if (!seller) return;

        // Обрабатываем каждый товар в чеке
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            if (!product) return;

            // Рассчитываем выручку и прибыль
            const revenue = calculateRevenue(item, product);
            const cost = product.cost_price * item.quantity;
            const profit = revenue - cost;

            // Обновляем статистику продавца
            seller.revenue += revenue;
            seller.profit += profit;
            seller.sales_count += item.quantity;

            // Обновляем статистику по товарам
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    // Фильтруем продавцов, у которых были продажи
    const sellersWithSales = sellerStats.filter(seller => seller.sales_count > 0);
    
    // Если нет продавцов с продажами, возвращаем пустой массив
    if (sellersWithSales.length === 0) {
        return [];
    }

    // Сортируем по убыванию прибыли
    sellersWithSales.sort((a, b) => b.profit - a.profit);

    // Рассчитываем бонусы
    const totalSellers = sellersWithSales.length;
    sellersWithSales.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, totalSellers, seller);
    });

    // Формируем итоговый результат
    return sellersWithSales.map(seller => {
        // Формируем топ-10 товаров
        const topProducts = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);

        return {
            seller_id: seller.id,
            name: seller.name,
            revenue: Math.round(seller.revenue * 100) / 100,
            profit: Math.round(seller.profit * 100) / 100,
            sales_count: seller.sales_count,
            bonus: Math.round(seller.bonus * 100) / 100,
            top_products: topProducts
        };
    });
}