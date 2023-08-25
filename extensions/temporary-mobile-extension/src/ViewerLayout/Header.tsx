const React = window.sharedLibraries['react'];
const PropTypes = window.sharedLibraries['prop-types'];
const { useTranslation } = window.sharedLibraries['react-i18next'];
const classNames = window.sharedLibraries['classnames'];
const { NavBar, Icon, IconButton, Dropdown } = window.sharedLibraries['@ohif/ui]'];

function Header({
  children,
  menuOptions,
  isReturnEnabled,
  onClickReturnButton,
  isSticky,
  whiteLabeling,
  servicesManager,
  ...props
}): React.ReactNode {
  const { t } = useTranslation('Header');
  const { customizationService } = servicesManager.services;
  const headerText = customizationService.getCustomization('HeaderText')?.value;

  // TODO: this should be passed in as a prop instead and the react-router-dom
  // dependency should be dropped
  const onClickReturn = () => {
    if (isReturnEnabled && onClickReturnButton) {
      onClickReturnButton();
    }
  };

  return (
    <NavBar
      className="justify-between border-b-4 border-black"
      isSticky={isSticky}
    >
      <div className="flex justify-between flex-1">
        <div className="flex items-center">
          {/* // TODO: Should preserve filter/sort
              // Either injected service? Or context (like react router's `useLocation`?) */}
          <div
            className={classNames(
              'inline-flex items-center mr-3',
              isReturnEnabled && 'cursor-pointer'
            )}
            data-cy="return-to-study-list"
            onClick={onClickReturn}
          >
            {isReturnEnabled && (
              <Icon name="chevron-left" className="w-8 text-primary-active" />
            )}
          </div>
        </div>
        <div className="flex items-center">
          {children}
        </div>
      </div>
    </NavBar>
  );
}

Header.propTypes = {
  menuOptions: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      icon: PropTypes.string,
      onClick: PropTypes.func.isRequired,
    })
  ),
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
  isReturnEnabled: PropTypes.bool,
  isSticky: PropTypes.bool,
  onClickReturnButton: PropTypes.func,
  whiteLabeling: PropTypes.object,
  servicesManager: PropTypes.object.isRequired,
};

Header.defaultProps = {
  isReturnEnabled: true,
  isSticky: false,
};

export default Header;
