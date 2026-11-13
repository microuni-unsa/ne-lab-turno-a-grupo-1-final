package bd.lab;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.GridLayout;
import java.awt.Insets;
import java.awt.event.ActionEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import javax.swing.JButton;
import javax.swing.JComboBox;
import javax.swing.JComponent;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.SwingUtilities;
import javax.swing.UIManager;
import javax.swing.border.EmptyBorder;
import javax.swing.table.DefaultTableModel;

import com.formdev.flatlaf.FlatLightLaf;

public class V1Z_TIPVIV extends JFrame {
    // DB connection
    public static final String URL = "jdbc:postgresql://localhost:5432/catastro-municipal";
    public static final String USERNAME = "postgres";
    public static final String PASSWORD = "7xAkg3wQ24KAJsYXRYfdzG6oQVGQPtgh";
    public static final String TABLE_NAME = "v1z_tipviv";
    public static final String IDENTIFIER = "tipvivcod";
    public static final String ESTREG = "tipvivestreg";

    public static final HashMap<String, Item> COLUMNS = new LinkedHashMap<>();
    public boolean updatingFlag = false;
    public boolean modifyFlag = false;
    public boolean deleteFlag = false;
    public boolean inactivateFlag = false;
    public boolean reactivateFlag = false;

    // UI components
    private JPanel formPanel;
    private JTable table;
    private DefaultTableModel tableModel;
    private HashMap<String, JComponent> inputs = new HashMap<>();

    // Preloaded lookup values
    private Map<String, java.util.List<Lookup>> lookups = new HashMap<>();

    // Set of non-nullable columns
    private final HashSet<String> nonNullableColumns = new HashSet<>();

    static {
        COLUMNS.put("tipvivcod", new Item("Código", 30, "", "", ""));
        COLUMNS.put("tipvivnom", new Item("Nombre", 200, "", "", ""));
        COLUMNS.put("tipvivestreg", new Item("Estado", 30, "gzz_estreg", "estregcod", "estregnom"));
    }

    public static void main(String[] args) throws Exception {
        UIManager.setLookAndFeel(new FlatLightLaf());

        SwingUtilities.invokeLater(() -> {
            try {
                new V1Z_TIPVIV().setVisible(true);
            } catch (Exception ex) {
                JOptionPane.showMessageDialog(null, "Error al iniciar la aplicación: " + ex.getMessage(),
                        "Error", JOptionPane.ERROR_MESSAGE);
            }
        });
    }

    public V1Z_TIPVIV() throws Exception {
        super(TABLE_NAME);
        setTitle("Gestión de " + TABLE_NAME);
        fetchNonNullableColumns();
        loadLookups();
        initUI();
        loadTableData();
        setDefaultCloseOperation(DO_NOTHING_ON_CLOSE);
        setSize(800, 800);
        setResizable(false);
        setLocationRelativeTo(null);
        // Disable close, maximize, minimize
        addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosing(WindowEvent e) {
                // Do nothing
            }
        });
    }

    /**
     * Fetches the non-nullable columns from the table metadata and stores them in nonNullableColumns.
     */
    private void fetchNonNullableColumns() throws SQLException {
        try (Connection con = DriverManager.getConnection(URL, USERNAME, PASSWORD)) {
            DatabaseMetaData meta = con.getMetaData();
            try (ResultSet rs = meta.getColumns(null, null, TABLE_NAME, null)) {
                while (rs.next()) {
                    String colName = rs.getString("COLUMN_NAME");
                    int nullable = rs.getInt("NULLABLE");
                    if (nullable == DatabaseMetaData.columnNoNulls) {
                        nonNullableColumns.add(colName.toLowerCase());
                    }
                }
            }
        }
    }

    private JLabel headerLabel;
    private JLabel formHeaderLabel;
    private JLabel tableHeaderLabel;
    private JButton btnAdicionar, btnModificar, btnEliminar, btnInactivar, btnReactivar, btnActualizar, btnCancelar,
            btnSalir;

    private void loadLookups() throws SQLException {
        try (Connection con = DriverManager.getConnection(URL, USERNAME, PASSWORD)) {
            for (Item col : COLUMNS.values()) {
                if (!col.valuesTable.isEmpty()) {
                    java.util.List<Lookup> list = new ArrayList<>();
                    String sql = String.format("SELECT %s, %s FROM %s",
                            col.valuesId, col.valuesVal, col.valuesTable);
                    try (Statement st = con.createStatement();
                            ResultSet rs = st.executeQuery(sql)) {
                        while (rs.next()) {
                            list.add(new Lookup(rs.getObject(1), rs.getString(2)));
                        }
                    }
                    lookups.put(col.label, list);
                }
            }
        }
    }

    private void initUI() {
        setLayout(new BorderLayout());
        Color sectionBg = new Color(230, 230, 230);
        Color sectionDarkBg = new Color(200, 200, 200);
        int sectionPad = 12;
        // -----------------------------------
        JPanel topPanel = new JPanel(new BorderLayout());
        topPanel.setBorder(new EmptyBorder(sectionPad, sectionPad, sectionPad, sectionPad));
        topPanel.setBackground(sectionBg);
        // -----------------------------------
        headerLabel = new JLabel(TABLE_NAME);
        headerLabel.setHorizontalAlignment(JLabel.LEFT);
        topPanel.add(headerLabel, BorderLayout.NORTH);
        // Form section with left alignment
        JPanel formSection = new JPanel(new BorderLayout());
        formSection.setBackground(sectionDarkBg);
        formSection.setBorder(new EmptyBorder(sectionPad, sectionPad, sectionPad, sectionPad));
        // Form header
        formHeaderLabel = new JLabel("Registro de " + TABLE_NAME);
        formHeaderLabel.setHorizontalAlignment(JLabel.LEFT);
        formSection.add(formHeaderLabel, BorderLayout.NORTH);
        // Form panel (fields)
        formPanel = new JPanel();
        formPanel.setLayout(new GridBagLayout());
        formPanel.setBackground(sectionDarkBg);
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.gridx = 0;
        gbc.gridy = 0;
        gbc.insets = new Insets(5, 5, 5, 5);
        gbc.anchor = GridBagConstraints.WEST;
        for (String key : COLUMNS.keySet()) {
            Item col = COLUMNS.get(key);
            JPanel labelPanel = new JPanel(new BorderLayout());
            labelPanel.setBackground(sectionDarkBg);
            JLabel fieldLabel = new JLabel(col.label + ":");
            labelPanel.add(fieldLabel, BorderLayout.WEST);
            if (nonNullableColumns.contains(key)) {
                JLabel asterisk = new JLabel("*");
                asterisk.setForeground(Color.RED);
                labelPanel.add(asterisk, BorderLayout.EAST);
            }
            formPanel.add(labelPanel, gbc);
            gbc.gridx++;
            JComponent input;
            if (col.valuesTable.isEmpty()) {
                input = new JTextField(col.width / 10);
            } else {
                JComboBox<Lookup> combo = new JComboBox<>();
                lookups.get(col.label).forEach(combo::addItem);
                input = combo;
            }
            input.setEnabled(false);
            inputs.put(key, input);
            formPanel.add(input, gbc);
            gbc.gridx = 0;
            gbc.gridy++;
        }
        formSection.add(formPanel, BorderLayout.CENTER);
        topPanel.add(formSection, BorderLayout.CENTER);
        add(topPanel, BorderLayout.NORTH);
        // --- BOTTOM PANEL (Table + Buttons) ---
        JPanel bottomPanel = new JPanel(new BorderLayout());
        bottomPanel.setBackground(sectionBg);
        bottomPanel.setBorder(new EmptyBorder(sectionPad, sectionPad, sectionPad, sectionPad));
        // Table section with header
        JPanel tablePanel = new JPanel(new BorderLayout());
        tablePanel.setBackground(sectionBg);
        tablePanel.setBorder(new EmptyBorder(0, 0, sectionPad, 0));
        tableHeaderLabel = new JLabel("Tabla de " + TABLE_NAME);
        tableHeaderLabel.setHorizontalAlignment(JLabel.LEFT);
        tablePanel.add(tableHeaderLabel, BorderLayout.NORTH);
        tableModel = new DefaultTableModel() {
            @Override
            public boolean isCellEditable(int row, int column) {
                return false;
            }
        };
        COLUMNS.keySet().forEach(tableModel::addColumn);
        table = new JTable(tableModel);
        table.setFillsViewportHeight(true);
        JScrollPane tableScroll = new JScrollPane(table);
        tableScroll.setBackground(sectionDarkBg);
        tableScroll.setBorder(new EmptyBorder(sectionPad, sectionPad, sectionPad, sectionPad));
        tableScroll.getViewport().setBackground(sectionDarkBg);
        tablePanel.add(tableScroll, BorderLayout.CENTER);
        bottomPanel.add(tablePanel, BorderLayout.CENTER);
        // Buttons
        JPanel btns = new JPanel(new GridLayout(2, 4, 10, 5));
        btnAdicionar = new JButton("Adicionar");
        btnModificar = new JButton("Modificar");
        btnEliminar = new JButton("Eliminar");
        btnCancelar = new JButton("Cancelar");
        btnInactivar = new JButton("Inactivar");
        btnReactivar = new JButton("Reactivar");
        btnActualizar = new JButton("Actualizar");
        btnSalir = new JButton("Salir");
        JButton[] row1 = { btnAdicionar, btnModificar, btnEliminar, btnCancelar };
        JButton[] row2 = { btnInactivar, btnReactivar, btnActualizar, btnSalir };
        for (JButton b : row1) {
            b.addActionListener(this::onButton);
            btns.add(b);
        }
        for (JButton b : row2) {
            b.addActionListener(this::onButton);
            btns.add(b);
        }
        btns.setBorder(new EmptyBorder(sectionPad, sectionPad, sectionPad, sectionPad));
        btns.setBackground(sectionDarkBg);
        bottomPanel.add(btns, BorderLayout.SOUTH);
        add(bottomPanel, BorderLayout.CENTER);
    }

    private void loadTableData() throws SQLException {
        tableModel.setRowCount(0);
        try (Connection con = DriverManager.getConnection(URL, USERNAME, PASSWORD);
                Statement st = con.createStatement();
                ResultSet rs = st.executeQuery("SELECT * FROM " + TABLE_NAME)) {
            while (rs.next()) {
                Object[] row = new Object[COLUMNS.size()];
                int i = 0;
                for (String key : COLUMNS.keySet()) {
                    Object v = rs.getObject(key);
                    Item col = COLUMNS.get(key);
                    if (!col.valuesTable.isEmpty()) {
                        // convert id to display value
                        for (Lookup lk : lookups.get(col.label)) {
                            if (lk.id.equals(v)) {
                                v = lk.label;
                                break;
                            }
                        }
                    }
                    row[i++] = v;
                }
                tableModel.addRow(row);
            }
        }
    }

    private void onButton(ActionEvent e) {
        String cmd = ((JButton) e.getSource()).getText();
        try {
            switch (cmd) {
                case "Adicionar" -> beginAdd();
                case "Modificar" -> beginModify();
                case "Eliminar" -> beginDelete();
                case "Inactivar" -> beginInactivate();
                case "Reactivar" -> beginReactivate();
                case "Actualizar" -> doUpdate();
                case "Cancelar" -> doCancel();
                case "Salir" -> dispose();
            }
        } catch (SQLException ex) {
            JOptionPane.showMessageDialog(this, ex.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
        }
    }

    private void enableForm(boolean en) {
        inputs.values().forEach(c -> c.setEnabled(en));
    }

    private void clearForm() {
        inputs.forEach((_a, c) -> {
            if (c instanceof JTextField jTextField)
                jTextField.setText("");
            else if (c instanceof JComboBox)
                ((JComboBox<?>) c).setSelectedIndex(-1);
        });
    }

    private void beginAdd() {
        if (updatingFlag)
            errorPending();
        clearForm();
        enableForm(true);
        inputs.get(ESTREG).setEnabled(false);
        ((JComboBox<?>) inputs.get(ESTREG)).setSelectedItem(
                lookups.get(COLUMNS.get(ESTREG).label).stream()
                        .filter(l -> l.id.equals(1)).findFirst().orElse(null));
        updatingFlag = true;
        btnCancelar.setVisible(true);
    }

    private void beginModify() {
        if (updatingFlag)
            errorPending();
        modifyFlag = updatingFlag = true;
        table.addMouseListener(modifyListener);
        btnCancelar.setVisible(true);
    }

    final private MouseListener modifyListener = new MouseAdapter() {
        @Override
        public void mouseClicked(MouseEvent e) {
            if (!modifyFlag)
                return;
            int r = table.getSelectedRow();
            if (r < 0)
                return;
            clearForm();
            enableForm(true);
            int i = 0;
            for (String key : COLUMNS.keySet()) {
                Object v = tableModel.getValueAt(r, i++);
                JComponent c = inputs.get(key);
                if (c instanceof JTextField jTextField)
                    jTextField.setText(v == null ? "" : v.toString());
                else if (c instanceof JComboBox jComboBox)
                    jComboBox.setSelectedItem(
                            lookups.get(COLUMNS.get(key).label).stream()
                                    .filter(l -> l.label.equals(v)).findFirst().orElse(null));
            }
            inputs.get(ESTREG).setEnabled(false);
            inputs.get(IDENTIFIER).setEnabled(false);
            table.removeMouseListener(this);
        }
    };

    private void beginDelete() {
        deleteFlag = true;
        beginFlag(3);
        btnCancelar.setVisible(true);
    }

    private void beginInactivate() {
        inactivateFlag = true;
        beginFlag(2);
        btnCancelar.setVisible(true);
    }

    private void beginReactivate() {
        reactivateFlag = true;
        beginFlag(1);
        btnCancelar.setVisible(true);
    }

    private void beginFlag(int statusId) {
        if (updatingFlag)
            errorPending();
        updatingFlag = true;
        table.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                int r = table.getSelectedRow();
                if (r < 0)
                    return;
                clearForm();
                enableForm(false);
                int i = 0;
                for (String key : COLUMNS.keySet()) {
                    Object v = tableModel.getValueAt(r, i++);
                    JComponent c = inputs.get(key);
                    if (c instanceof JTextField jTextField)
                        jTextField.setText(v == null ? "" : v.toString());
                    else if (c instanceof JComboBox jComboBox)
                        jComboBox.setSelectedItem(
                                lookups.get(COLUMNS.get(key).label).stream()
                                        .filter(l -> l.label.equals(v)).findFirst().orElse(null));
                }
                ((JComboBox<?>) inputs.get(ESTREG)).setSelectedItem(
                        lookups.get(COLUMNS.get(ESTREG).label).stream()
                                .filter(l -> l.id.equals(statusId)).findFirst().orElse(null));
                table.removeMouseListener(this);
            }
        });
    }

    private void doUpdate() throws SQLException {
        if (!updatingFlag)
            return;
        
        // Validate required fields
        for (String key : COLUMNS.keySet()) {
            if (nonNullableColumns.contains(key)) {
                JComponent c = inputs.get(key);
                if (c instanceof JTextField) {
                    String text = ((JTextField) c).getText().trim();
                    if (text.isEmpty()) {
                        JOptionPane.showMessageDialog(this, 
                            "El campo '" + COLUMNS.get(key).label + "' es obligatorio.", 
                            "Campo requerido", 
                            JOptionPane.WARNING_MESSAGE);
                        return;
                    }
                } else if (c instanceof JComboBox) {
                    if (((JComboBox<?>) c).getSelectedItem() == null) {
                        JOptionPane.showMessageDialog(this, 
                            "El campo '" + COLUMNS.get(key).label + "' es obligatorio.", 
                            "Campo requerido", 
                            JOptionPane.WARNING_MESSAGE);
                        return;
                    }
                }
            }
        }
        
        StringBuilder sql;
        java.util.List<Object> params = new ArrayList<>();

        if (modifyFlag) {
            sql = new StringBuilder("UPDATE " + TABLE_NAME + " SET ");
            for (String key : COLUMNS.keySet()) {
                sql.append(key).append("=?,");
                Object val = getInputValue(key);
                params.add(val);
            }
            sql.setLength(sql.length() - 1);
            sql.append(" WHERE ").append(IDENTIFIER).append("=?");
            params.add(getInputValue(IDENTIFIER));
        } else {
            // insert or status‐only update
            if (deleteFlag || inactivateFlag || reactivateFlag) {
                sql = new StringBuilder("UPDATE " + TABLE_NAME + " SET " + ESTREG + " =? WHERE " + IDENTIFIER + "=?");
                params.add(((Lookup) ((JComboBox<?>) inputs.get(ESTREG)).getSelectedItem()).id);
                params.add(getInputValue(IDENTIFIER));
            } else {
                sql = new StringBuilder("INSERT INTO " + TABLE_NAME + " (");
                StringBuilder vals = new StringBuilder(" VALUES(");
                for (String key : COLUMNS.keySet()) {
                    sql.append(key).append(",");
                    vals.append("?,");
                    params.add(getInputValue(key));
                }
                sql.setLength(sql.length() - 1);
                vals.setLength(vals.length() - 1);
                sql.append(")").append(vals).append(")");
            }
        }

        try (Connection con = DriverManager.getConnection(URL, USERNAME, PASSWORD);
                PreparedStatement ps = con.prepareStatement(sql.toString())) {
            for (int i = 0; i < params.size(); i++)
                ps.setObject(i + 1, params.get(i));
            ps.executeUpdate();
        }

        loadTableData();
        doCancel();
    }

    private Object getInputValue(String key) {
        JComponent c = inputs.get(key);
        if (c instanceof JTextField) {
            String text = ((JTextField) c).getText().trim();
            if (text.isEmpty()) {
                return null;
            }
            // Convert to appropriate type based on column
            if (key.equals("tipvivcod")) {
                try {
                    return Short.parseShort(text);
                } catch (NumberFormatException e) {
                    JOptionPane.showMessageDialog(this, 
                        "El código debe ser un número entero válido (0-32767)", 
                        "Error de formato", 
                        JOptionPane.ERROR_MESSAGE);
                    throw new RuntimeException("Formato de número inválido");
                }
            }
            return text;
        }
        Lookup lk = (Lookup) ((JComboBox<?>) c).getSelectedItem();
        return lk == null ? null : lk.id;
    }

    private void doCancel() {
        updatingFlag = modifyFlag = deleteFlag = inactivateFlag = reactivateFlag = false;
        clearForm();
        enableForm(false);
    }

    private void errorPending() {
        JOptionPane.showMessageDialog(this, "Operación pendiente. Por favor, complete o cancele la operación actual.",
                "Operación pendiente", JOptionPane.WARNING_MESSAGE);
    }

    // Helper classes
    public static class Item {
        public String label;
        public int width;
        public String valuesTable, valuesId, valuesVal;

        public Item(String l, int w, String vt, String vi, String vv) {
            label = l;
            width = w;
            valuesTable = vt;
            valuesId = vi;
            valuesVal = vv;
        }
    }

    private static class Lookup {
        public Object id;
        public String label;

        public Lookup(Object i, String l) {
            id = i;
            label = l;
        }

        @Override
        public String toString() {
            return label;
        }

        @Override
        public boolean equals(Object o) {
            return o instanceof Lookup && Objects.equals(((Lookup) o).label, label);
        }
    }
}
